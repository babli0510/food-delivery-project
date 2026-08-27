import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const Orders = () => {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/orders/my-orders");

      const data = response.data;

      setOrders(
        Array.isArray(data)
          ? data
          : data.orders || []
      );
    } catch (err) {
      console.error("My orders fetch error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load your orders."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusText = (status) => {
    switch (status) {
      case "pending":
        return "Order Placed";

      case "confirmed":
        return "Order Confirmed";

      case "preparing":
        return "Food is Being Prepared";

      case "ready":
        return "Ready for Delivery";

      case "picked_up":
        return "Picked Up by Delivery Partner";

      case "out_for_delivery":
        return "Out for Delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Order Cancelled";

      default:
        return status || "Processing";
    }
  };

  const getStatusEmoji = (status) => {
    switch (status) {
      case "pending":
        return "📝";

      case "confirmed":
        return "✅";

      case "preparing":
        return "👨‍🍳";

      case "ready":
        return "📦";

      case "picked_up":
        return "🛵";

      case "out_for_delivery":
        return "🚴";

      case "delivered":
        return "🎉";

      case "cancelled":
        return "❌";

      default:
        return "⏳";
    }
  };

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="orders-page">

      {/* Header */}
      <header className="restaurant-header">

        <div
          className="logo"
          onClick={() => navigate("/restaurants")}
          style={{ cursor: "pointer" }}
        >
          🍔 FoodDelivery
        </div>

        <div className="header-actions">

          <button
            onClick={() => navigate("/restaurants")}
          >
            Restaurants
          </button>

          <button
            onClick={() => navigate("/cart")}
          >
            Cart
          </button>

        </div>

      </header>

      {/* Main */}
      <main className="orders-container">

        <div className="orders-heading">

          <div>
            <h1>My Orders</h1>

            <p>
              View your previous and current orders
            </p>
          </div>

          <button
            onClick={fetchOrders}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-page">
            <h2>Loading your orders...</h2>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="error-page">

            <h2>{error}</h2>

            <button onClick={fetchOrders}>
              Try Again
            </button>

          </div>
        )}

        {/* Empty */}
        {!loading && !error && orders.length === 0 && (
          <div className="empty-state">

            <div
              style={{
                fontSize: "60px",
                marginBottom: "15px",
              }}
            >
              🛍️
            </div>

            <h2>No Orders Yet</h2>

            <p>
              You haven't placed any orders yet.
            </p>

            <button
              className="primary-button"
              onClick={() => navigate("/restaurants")}
            >
              🍔 Start Ordering
            </button>

          </div>
        )}

        {/* Orders */}
        {!loading && !error && orders.length > 0 && (
          <div className="orders-list">

            {orders.map((order) => {

              const subtotal =
                order.subtotal ??
                order.items?.reduce(
                  (total, item) =>
                    total +
                    Number(item.price || 0) *
                    Number(item.quantity || 0),
                  0
                ) ??
                0;

              const deliveryFee =
                order.deliveryFee ?? 0;

              const totalAmount =
                order.totalAmount ??
                subtotal + deliveryFee;

              return (
                <div
                  className="order-card"
                  key={order._id}
                >

                  {/* Order Header */}
                  <div className="order-card-header">

                    <div>
                      <h2>
                        {order.restaurant?.name ||
                          order.restaurantName ||
                          "Restaurant"}
                      </h2>

                      <p>
                        Order ID:{" "}
                        <strong>
                          {order._id}
                        </strong>
                      </p>

                      {order.createdAt && (
                        <p>
                          {formatDate(order.createdAt)}
                        </p>
                      )}
                    </div>

                    <div className="order-status">

                      <span className="status-emoji">
                        {getStatusEmoji(
                          order.status
                        )}
                      </span>

                      <strong>
                        {getStatusText(
                          order.status
                        )}
                      </strong>

                    </div>

                  </div>

                  {/* Items */}
                  <div className="order-card-items">

                    {order.items?.map(
                      (item, index) => (

                        <div
                          className="order-card-item"
                          key={
                            item._id || index
                          }
                        >

                          <div>
                            <strong>
                              {item.name}
                            </strong>

                            <p>
                              ₹{item.price} ×{" "}
                              {item.quantity}
                            </p>
                          </div>

                          <strong>
                            ₹
                            {Number(
                              item.price || 0
                            ) *
                              Number(
                                item.quantity || 0
                              )}
                          </strong>

                        </div>

                      )
                    )}

                  </div>

                  <hr />

                  {/* Amount */}
                  <div className="order-card-summary">

                    <div>
                      <span>
                        Subtotal
                      </span>

                      <span>
                        ₹{subtotal}
                      </span>
                    </div>

                    <div>
                      <span>
                        Delivery Fee
                      </span>

                      <span>
                        {deliveryFee === 0
                          ? "FREE"
                          : `₹${deliveryFee}`}
                      </span>
                    </div>

                    <div className="order-total">

                      <strong>
                        Total
                      </strong>

                      <strong>
                        ₹{totalAmount}
                      </strong>

                    </div>

                  </div>

                  {/* View Details */}
                  <div className="order-card-actions">

                    <button
                      className="primary-button"
                      onClick={() =>
                        navigate(
                          `/orders/${order._id}`
                        )
                      }
                    >
                      View Order Details
                    </button>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </main>

    </div>
  );
};

export default Orders;