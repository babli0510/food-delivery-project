import { Routes, Route, Navigate } from "react-router-dom";

// Customer Pages
import Login from "./pages/customer/Login";
import Register from "./pages/customer/Register";
import Restaurants from "./pages/customer/Restaurants";
import RestaurantDetails from "./pages/customer/RestaurantDetails";
import Cart from "./pages/customer/Cart";
import Checkout from "./pages/customer/Checkout";
import OrderDetails from "./pages/customer/OrderDetails";
import Orders from "./pages/customer/Orders";

function App() {
  return (
    <Routes>

      {/* =========================
          AUTHENTICATION
      ========================= */}

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />


      {/* =========================
          CUSTOMER
      ========================= */}

      <Route
        path="/restaurants"
        element={<Restaurants />}
      />

      <Route
        path="/restaurants/:restaurantId"
        element={<RestaurantDetails />}
      />

      <Route
        path="/cart"
        element={<Cart />}
      />

      <Route
        path="/checkout"
        element={<Checkout />}
      />


      {/* =========================
          ORDERS
      ========================= */}

      {/* Single Order Details */}
      <Route
        path="/orders/:orderId"
        element={<OrderDetails />}
      />

      {/* All My Orders */}
      <Route
        path="/orders"
        element={<Orders />}
      />


      {/* =========================
          DEFAULT
      ========================= */}

      <Route
        path="/"
        element={
          <Navigate
            to="/restaurants"
            replace
          />
        }
      />

      {/* Unknown URL */}
      <Route
        path="*"
        element={
          <Navigate
            to="/restaurants"
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;