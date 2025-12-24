// import React from "react";
// import { Navigate } from "react-router-dom";

// const ProtectedRoute = ({ children, role }) => {
//   const token = localStorage.getItem("token");
//   const userRole = localStorage.getItem("role");

//   if (!token || (role && userRole !== role)) {
//     return <Navigate to={userRole === "merchant" ? "/merchant-login" : "/customer-login"} replace />;
//   }

//   return children;
// };

// export default ProtectedRoute;

import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role"); // 'merchant' or 'customer'
  const location = useLocation();

  // 1. CASE: User is NOT logged in at all
  if (!token) {
    // If they were trying to access a merchant route, send to merchant login
    // Otherwise, send to the generic login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. CASE: User IS logged in, but has the WRONG role
  // (e.g., A Customer trying to access the Merchant Dashboard)
  if (role && userRole !== role) {
    // Redirect them to THEIR correct home page based on who they actually are
    if (userRole === "merchant") {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/my-bills" replace />; // or '/customer-home'
    }
  }

  // 3. CASE: Access Granted
  return children;
};

export default ProtectedRoute;
