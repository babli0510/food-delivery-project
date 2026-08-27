import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchOrder = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get(
        `/orders/${orderId}`
      );

      console.log(
        "Order details response:",
        response.data
      );

      setOrder(
        response.data.order ||
        response.data
      );

    } catch (err) {
      console.error(
        "Order details error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to load order details."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  useEffect(() => {

    if (orderId) {
      fetchOrder();
    }

  }, [orderId]);


  const getStatusText = (status) => {

    switch (status) {

      case "pending":
        return "Order Placed";

      case "confirmed":
        return "Confirmed";

      case "preparing":
        return "Preparing";

      case "ready":
        return "Ready for Delivery";

      case "picked_up":
        return "Picked Up";

      case "out_for_delivery":
        return "Out for Delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Cancelled";

      default:
        return "Processing";

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

    if (!date) {
      return "Date unavailable";
    }

    try {

      return new Date(date).toLocaleString(
        "en-IN",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      );

    } catch {

      return "Date unavailable";

    }

  };


  if (loading) {

    return (

      <div className="order-page">

        <div className="loading-page">

          <h2>
            Loading your order...
          </h2>

        </div>

      </div>

    );

  }


  if (error) {

    return (

      <div className="order-page">

        <main className="order-container">

          <div className="error-page">

            <h2>
              {error}
            </h2>

            <button
              onClick={() =>
                navigate("/orders")
              }
            >
              ← Back to My Orders
            </button>

          </div>

        </main>

      </div>

    );

  }


  if (!order) {

    return (

      <div className="order-page">

        <main className="order-container">

          <div className="error-page">

            <h2>
              Order not found.
            </h2>

            <button
              onClick={() =>
                navigate("/orders")
              }
            >
              ← Back to My Orders
            </button>

          </div>

        </main>

      </div>

    );

  }


  const subtotal =
    order.subtotal ??
    order.items?.reduce(
      (sum, item) =>
        sum +
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


  const restaurantName =
    order.restaurant?.name ||
    order.restaurantName ||
    "Restaurant";


  return (

    <div className="order-page">


      {/* =========================
          HEADER
      ========================= */}

      <header className="restaurant-header">

        <div
          className="logo"
          onClick={() =>
            navigate("/restaurants")
          }
        >
          🍔 FoodDelivery
        </div>


        <div className="header-actions">

          <button
            onClick={() =>
              navigate("/restaurants")
            }
          >
            Restaurants
          </button>

          <button
            onClick={() =>
              navigate("/orders")
            }
          >
            My Orders
          </button>

        </div>

      </header>


      {/* =========================
          MAIN
      ========================= */}

      <main className="order-container">


        {/* SUCCESS */}

        <section className="order-success">

          <div className="success-icon">
            🎉
          </div>

          <h1>
            Order Placed Successfully!
          </h1>

          <p>
            Thank you for ordering
            with FoodDelivery.
          </p>

          <p className="order-id">
            Order ID:{" "}
            <strong>
              {order._id}
            </strong>
          </p>

          <p>
            Ordered on:{" "}
            <strong>
              {formatDate(
                order.createdAt
              )}
            </strong>
          </p>

        </section>


        {/* STATUS */}

        <section className="order-status-card">

          <h2>
            Order Status
          </h2>


          <div className="status-display">

            <div className="status-icon">
              {getStatusEmoji(
                order.status
              )}
            </div>


            <div>

              <h3>
                {getStatusText(
                  order.status
                )}
              </h3>

              <p>
                Current status
              </p>

            </div>

          </div>


          {/* STATUS TIMELINE */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(5, 1fr)",
              gap: "8px",
              marginTop: "25px",
              textAlign: "center",
            }}
          >

            {[
              ["pending", "📝", "Placed"],
              ["confirmed", "✅", "Confirmed"],
              ["preparing", "👨‍🍳", "Preparing"],
              ["out_for_delivery", "🛵", "Out for Delivery"],
              ["delivered", "🎉", "Delivered"],
            ].map(
              ([status, emoji, label]) => (

                <div
                  key={status}
                  style={{
                    padding: "10px 5px",
                    borderRadius: "8px",
                    background:
                      order.status === status
                        ? "#fff3e0"
                        : "#f7f7f7",
                    fontSize: "13px",
                  }}
                >

                  <div
                    style={{
                      fontSize: "22px",
                    }}
                  >
                    {emoji}
                  </div>

                  <div>
                    {label}
                  </div>

                </div>

              )
            )}

          </div>


          {order.estimatedDeliveryMinutes && (

            <div className="estimated-time">

              🕐 Estimated delivery:{" "}

              <strong>
                {order.estimatedDeliveryMinutes}
                {" "}
                minutes
              </strong>

            </div>

          )}

        </section>


        {/* RESTAURANT */}

        <section className="order-section">

          <h2>
            Restaurant
          </h2>

          <div className="restaurant-order-card">

            <h3>
              {restaurantName}
            </h3>

          </div>

        </section>


        {/* ITEMS */}

        <section className="order-section">

          <h2>
            Ordered Items
          </h2>

          <div className="order-items">

            {order.items?.map(
              (item, index) => (

                <div
                  className="order-item"
                  key={
                    item._id ||
                    index
                  }
                >

                  <div
                    className="order-item-details"
                  >

                    <h3>
                      {item.name}
                    </h3>

                    <p>
                      ₹{item.price} ×{" "}
                      {item.quantity}
                    </p>

                  </div>

                  <strong>
                    ₹
                    {Number(item.price) *
                      Number(item.quantity)}
                  </strong>

                </div>

              )
            )}

          </div>

        </section>


        {/* DELIVERY */}

        {order.deliveryLocation && (

          <section className="order-section">

            <h2>
              Delivery Details
            </h2>

            <div className="delivery-details">

              <p>
                📍 Delivery Location
              </p>

              {order.deliveryLocation.coordinates && (

                <>
                  <p>
                    Longitude:{" "}
                    {
                      order
                        .deliveryLocation
                        .coordinates[0]
                    }
                  </p>

                  <p>
                    Latitude:{" "}
                    {
                      order
                        .deliveryLocation
                        .coordinates[1]
                    }
                  </p>
                </>

              )}

            </div>

          </section>

        )}


        {/* PAYMENT SUMMARY */}

        <section className="order-summary">

          <h2>
            Payment Summary
          </h2>

          <div className="summary-row">

            <span>
              Subtotal
            </span>

            <span>
              ₹{subtotal}
            </span>

          </div>


          <div className="summary-row">

            <span>
              Delivery Fee
            </span>

            <span>
              {deliveryFee === 0
                ? "FREE"
                : `₹${deliveryFee}`}
            </span>

          </div>


          <hr />


          <div className="summary-total">

            <span>
              Total
            </span>

            <strong>
              ₹{totalAmount}
            </strong>

          </div>

        </section>


        {/* ACTIONS */}

        <div className="order-actions">

          <button
            className="primary-button"
            onClick={() =>
              navigate("/restaurants")
            }
          >
            🍔 Order More Food
          </button>


          <button
            onClick={() =>
              navigate("/orders")
            }
          >
            📋 My Orders
          </button>


          <button
            onClick={() =>
              fetchOrder(false)
            }
            disabled={refreshing}
          >
            🔄{" "}
            {refreshing
              ? "Refreshing..."
              : "Refresh Status"}
          </button>

        </div>


      </main>

    </div>

  );

};

export default OrderDetails;