import Receipt from "../models/Receipt.js";
import Merchant from "../models/Merchant.js";
import User from "../models/User.js";
import { getNowIST, normalizeToIST, formatISTDate, formatISTTime } from "../utils/timezone.js";
import { clearAnalyticsCache } from "./analyticsController.js";
import { sendReceiptEmail } from "../utils/sendEmail.js";

const normalizeItems = (items = []) =>
  items.map((item) => ({
    name: item.name || item.n || "Unknown",
    unitPrice:
      typeof item.unitPrice === "number"
        ? item.unitPrice
        : typeof item.price === "number"
        ? item.price
        : Number(item.p) || 0,
    quantity:
      typeof item.quantity === "number"
        ? item.quantity
        : typeof item.qty === "number"
        ? item.qty
        : Number(item.q) || 1,
  }));

const computeTotal = (items) =>
  items.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0), 0);

const mapReceiptToClient = (receipt) => {
  const transactionInstant = receipt.transactionDate || receipt.createdAt;
  const isoDate = formatISTDate(transactionInstant);
  const time = formatISTTime(transactionInstant);

  // Use receipt category first, fall back to merchant's businessCategory, then "general"
  const resolvedCategory = receipt.category || receipt.merchantSnapshot?.businessCategory || "general";

  return {
    id: receipt._id,
    merchant: receipt.merchantSnapshot?.shopName,
    merchantCode: receipt.merchantSnapshot?.merchantCode,
    merchantSnapshot: receipt.merchantSnapshot || null,
    businessCategory: receipt.merchantSnapshot?.businessCategory || null,
    customerName: receipt.customerSnapshot?.name || null,
    customerEmail: receipt.customerSnapshot?.email || null,
    amount: receipt.total,
    subtotal: receipt.subtotal || 0,
    discount: receipt.discount || 0,
    transactionDate: receipt.transactionDate ? new Date(receipt.transactionDate).toISOString() : null,
    date: isoDate,
    time,
    type: receipt.source,
    items: (receipt.items || []).map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.unitPrice,
    })),
    image: receipt.imageUrl,
    note: receipt.note,
    category: resolvedCategory,
    excludeFromStats: receipt.excludeFromStats,
    footer: receipt.footer || receipt.merchantSnapshot?.receiptFooter || "",
    status: receipt.status,
    paymentMethod: receipt.paymentMethod,
    paidAt: receipt.paidAt ? new Date(receipt.paidAt).toISOString() : null,
    createdAt: receipt.createdAt ? new Date(receipt.createdAt).toISOString() : null,
    updatedAt: receipt.updatedAt ? new Date(receipt.updatedAt).toISOString() : null,
  };
};

export const createReceipt = async (req, res) => {
  try {
    const {
      userId: bodyUserId = null,
      merchantId: bodyMerchantId = null,
      merchantCode = null,
      mid = null,
      items: rawItems = [],
      source = "qr",
      paymentMethod = "upi",
      transactionDate,
      note = "",
      imageUrl = null,
      excludeFromStats = false,
      footer = "",
      category = "general",
      total: providedTotal,
      subtotal: providedSubtotal,
      discount: providedDiscount = 0,
      status = "completed",
      receiptId = null,
      // For customer uploads without merchant
      merchantName = null,
    } = req.body;

    const resolvedMerchantId = req.user.role === "merchant" ? req.user.id : bodyMerchantId;
    const resolvedMerchantCode = merchantCode || mid;

    const userId = req.user.role === "customer" ? req.user.id : bodyUserId;

    const items = normalizeItems(rawItems);
    const computedTotal = computeTotal(items);

    // Handle discount calculations
    const discount = typeof providedDiscount === "number" ? Math.max(0, providedDiscount) : 0;
    const subtotal = typeof providedSubtotal === "number" ? providedSubtotal : computedTotal;
    
    // Final total should be subtotal minus discount
    let finalTotal;
    if (typeof providedTotal === "number") {
      finalTotal = providedTotal;
    } else if (subtotal > 0 && discount > 0) {
      finalTotal = Math.max(0, subtotal - discount);
    } else {
      finalTotal = computedTotal;
    }

    // For uploads without items, use provided total
    // For QR scans, also allow provided total if items are empty or total is explicitly provided
    if ((source === "upload" || source === "qr") && typeof providedTotal === "number") {
      finalTotal = providedTotal;
    }

    // Only validate total vs items for manual entries (not QR or upload)
    // QR codes may have pre-calculated totals that include taxes/discounts not in items
    if (source === "manual" && typeof providedTotal === "number" && items.length > 0) {
      const expectedTotal = Math.max(0, (typeof providedSubtotal === "number" ? providedSubtotal : computedTotal) - discount);
      if (Math.abs(providedTotal - expectedTotal) > 0.01) {
        return res.status(400).json({
          message: "Total does not match items sum (after discount)",
        });
      }
    }

    let merchant = null;
    // Try to find merchant in database if we have an ID or code
    if (resolvedMerchantId || resolvedMerchantCode) {
      if (resolvedMerchantId) {
        merchant = await Merchant.findById(resolvedMerchantId).lean();
      } else if (resolvedMerchantCode) {
        merchant = await Merchant.findOne({ merchantCode: resolvedMerchantCode }).lean();
      }
    }
    
    // For QR scans, we allow saving even if merchant is not found in our system
    // The customer can still record their transaction with merchantName from QR
    // Only merchants creating receipts MUST be registered
    if (!merchant && req.user.role === "merchant" && source !== "upload") {
      return res.status(400).json({ message: "Merchant not found" });
    }

    // Build customer snapshot - don't fail if user lookup fails
    // If user is authenticated (passed protect middleware), they are valid
    let customerSnapshot = null;
    if (userId) {
      try {
        const user = await User.findById(userId).lean();
        if (user) {
          customerSnapshot = { name: user.name, email: user.email };
        } else {
          // User authenticated but not found in DB - create minimal snapshot
          // This can happen in edge cases, but we should still save the receipt
          customerSnapshot = { name: "Customer", email: null };
          console.log(`Warning: Customer ${userId} not found in DB but authenticated`);
        }
      } catch (lookupError) {
        // Database error during lookup - proceed with minimal snapshot
        console.error("Customer lookup error:", lookupError.message);
        customerSnapshot = { name: "Customer", email: null };
      }
    }

    // Snapshot merchant data (or use provided name from QR code)
    const merchantSnapshot = merchant 
      ? {
          shopName: merchant.shopName,
          merchantCode: merchant.merchantCode,
          address: merchant.addressLine || (merchant.address ? `${merchant.address.street || ''}, ${merchant.address.city || ''}`.trim().replace(/^,\s*|,\s*$/g, '') : null),
          phone: merchant.phone,
          logoUrl: merchant.logoUrl,
          receiptHeader: merchant.receiptHeader || "",
          receiptFooter: merchant.receiptFooter || "Thank you! Visit again.",
          brandColor: merchant.brandColor || "#10b981",
          businessCategory: merchant.businessCategory || "general",
        }
      : merchantName 
        ? { 
            shopName: merchantName, 
            merchantCode: resolvedMerchantCode || null, 
            address: null, 
            phone: null, 
            logoUrl: null, 
            receiptHeader: "", 
            receiptFooter: footer || "Thank you!", 
            brandColor: "#10b981", 
            businessCategory: category || "general" 
          }
        : { 
            shopName: "Unknown Merchant", 
            merchantCode: null, 
            address: null, 
            phone: null, 
            logoUrl: null, 
            receiptHeader: "", 
            receiptFooter: "", 
            brandColor: "#10b981", 
            businessCategory: "general" 
          };

    const resolvedCategory = category || merchant?.businessCategory || "general";

    const receipt = await Receipt.create({
      _id: receiptId || undefined,
      merchantId: merchant?._id || null,
      merchantCode: merchant?.merchantCode || null,
      userId,
      items,
      total: finalTotal,
      subtotal,
      discount,
      source,
      paymentMethod,
      status,
      // Normalize to IST
      transactionDate: normalizeToIST(transactionDate),
      note,
      imageUrl,
      excludeFromStats: Boolean(excludeFromStats),
      footer: footer || merchant?.receiptFooter || "",
      category: resolvedCategory,
      merchantSnapshot,
      customerSnapshot,
    });

    // Update analytics cache
    if (merchant?._id) {
      clearAnalyticsCache(merchant._id.toString());
    }
    if (userId) {
      clearAnalyticsCache(userId.toString());
    }

    res.status(201).json(mapReceiptToClient(receipt.toObject()));
  } catch (error) {
    console.error("createReceipt error:", error.message);
    console.error("createReceipt error details:", error);
    
    // Return more specific error messages
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ message: `Validation error: ${messages}` });
    }
    
    res.status(500).json({ message: error.message || "Failed to create receipt" });
  }
};

export const getCustomerReceipts = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.id };

    const [receipts, total] = await Promise.all([
      Receipt.find(filter)
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Receipt.countDocuments(filter),
    ]);

    res.json({
      receipts: receipts.map(mapReceiptToClient),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("getCustomerReceipts error", error);
    res.status(500).json({ message: "Failed to load receipts" });
  }
};

export const claimReceipt = async (req, res) => {
  try {
    const { receiptId } = req.body;
    
    // Check if receipt exists and is not already claimed by someone else
    const receiptCheck = await Receipt.findById(receiptId);
    if (!receiptCheck) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    if (receiptCheck.userId && receiptCheck.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Receipt already claimed" });
    }

    // Prepare customer snapshot
    const user = await User.findById(req.user.id).lean();
    const customerSnapshot = user ? { name: user.name, email: user.email } : null;

    // Use atomic update to avoid race conditions with markReceiptPaid
    const receipt = await Receipt.findByIdAndUpdate(
      receiptId,
      {
        $set: {
          userId: req.user.id,
          customerSnapshot: customerSnapshot
        }
      },
      { new: true }
    );
    
    // Send receipt email to customer (async, don't await - don't block claim)
    if (user?.email && receipt) {
      const receiptForEmail = receipt.toObject();
      sendReceiptEmail({
        to: user.email,
        customerName: user.name || "Customer",
        merchantName: receiptForEmail.merchantSnapshot?.shopName || "Merchant",
        total: receiptForEmail.total || 0,
        date: formatISTDate(receiptForEmail.transactionDate || receiptForEmail.createdAt),
        items: receiptForEmail.items || [],
        paymentMethod: receiptForEmail.paymentMethod || "N/A"
      }).catch((err) => {
        console.error("[Receipt] Email failed:", err.message);
      });
    }

    res.json(mapReceiptToClient(receipt.toObject()));
  } catch (error) {
    console.error("claimReceipt error", error);
    res.status(500).json({ message: "Failed to claim receipt" });
  }
};

export const markReceiptPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body; // Accept payment method from merchant
    
    // Use atomic update to avoid race conditions with customer claim
    // We first check authorization in the query itself or separate check
    
    const receiptCheck = await Receipt.findById(id);
    if (!receiptCheck) {
      return res.status(404).json({ message: "Receipt not found" });
    }
    if (!receiptCheck.merchantId || receiptCheck.merchantId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to update receipt" });
    }

    // Determine the payment method to set
    const currentMethod = receiptCheck.paymentMethod;
    const isGeneric = !currentMethod || currentMethod === 'other';
    let newPaymentMethod = currentMethod;

    if (paymentMethod && ["upi", "cash", "card", "other"].includes(paymentMethod)) {
       // Allow overwrite if current is generic OR we want to trust the merchant's explicit action
       // The merchant's "Paid via Cash" or "Paid via UPI" button is a strong signal of what actually happened at the counter.
       // So we should probably prefer the merchant's input if they are explicitly marking it.
       newPaymentMethod = paymentMethod;
    }

    const receipt = await Receipt.findByIdAndUpdate(
      id,
      {
        $set: {
            status: "completed",
            paymentMethod: newPaymentMethod,
            paidAt: getNowIST()
        }
      },
      { new: true } // Return updated doc
    );

    // Invalidate cache
    clearAnalyticsCache(req.user.id);
    if (receipt.userId) {
      clearAnalyticsCache(receipt.userId.toString());
    }

    res.json(mapReceiptToClient(receipt.toObject()));
  } catch (error) {
    console.error("markReceiptPaid error", error);
    res.status(500).json({ message: "Failed to update receipt" });
  }
};

export const getMerchantReceipts = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = { merchantId: req.user.id };

    const [receipts, total] = await Promise.all([
      Receipt.find(filter)
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Receipt.countDocuments(filter),
    ]);

    res.json({
      receipts: receipts.map(mapReceiptToClient),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("getMerchantReceipts error", error);
    res.status(500).json({ message: "Failed to load receipts" });
  }
};

export const getReceiptById = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id).lean();

    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    const isOwner =
      (req.user.role === "customer" && receipt.userId?.toString() === req.user.id) ||
      (req.user.role === "merchant" && receipt.merchantId.toString() === req.user.id);

    if (!isOwner) {
      return res.status(403).json({ message: "Not authorized to view this receipt" });
    }

    res.json(mapReceiptToClient(receipt));
  } catch (error) {
    console.error("getReceiptById error", error);
    res.status(500).json({ message: "Failed to load receipt" });
  }
};

export const updateReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, status, note, excludeFromStats, category } = req.body;

    // Check strict ownership first
    const receiptCheck = await Receipt.findById(id);
    if (!receiptCheck) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    const isOwner =
      (req.user.role === "customer" && receiptCheck.userId?.toString() === req.user.id) ||
      (req.user.role === "merchant" && receiptCheck.merchantId?.toString() === req.user.id);

    if (!isOwner) {
      return res.status(403).json({ message: "Not authorized to update this receipt" });
    }

    // Build update object dynamically
    const updateFields = {};
    if (paymentMethod !== undefined) updateFields.paymentMethod = paymentMethod;
    if (status !== undefined) updateFields.status = status;
    if (note !== undefined) updateFields.note = note;
    if (excludeFromStats !== undefined) updateFields.excludeFromStats = Boolean(excludeFromStats);
    if (category !== undefined) updateFields.category = category;

    // Atomic update
    const receipt = await Receipt.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    res.json(mapReceiptToClient(receipt.toObject()));
  } catch (error) {
    console.error("updateReceipt error", error);
    res.status(500).json({ message: "Failed to update receipt" });
  }
};

export const deleteReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const receipt = await Receipt.findById(id);
    if (!receipt) {
      return res.status(404).json({ message: "Receipt not found" });
    }

    // Check ownership - customers can delete their receipts, merchants can delete their receipts
    const isOwner =
      (req.user.role === "customer" && receipt.userId?.toString() === req.user.id) ||
      (req.user.role === "merchant" && receipt.merchantId?.toString() === req.user.id);

    if (!isOwner) {
      return res.status(403).json({ message: "Not authorized to delete this receipt" });
    }

    await Receipt.findByIdAndDelete(id);
    res.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    console.error("deleteReceipt error", error);
    res.status(500).json({ message: "Failed to delete receipt" });
  }
};
