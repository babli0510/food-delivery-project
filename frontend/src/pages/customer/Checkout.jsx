import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../context/CartContext";

const Checkout = () => {
  const navigate = useNavigate();

  const {
    cart,
    subtotal,
    clearCart,
  } = useCart();

  const [coordinates, setCoordinates] = useState([
    75.9064,
    17.6599,
  ]);

  const [address, setAddress] = useState("");

  const [deliveryFee, setDeliveryFee] = useState(null);

  const [loading, setLoading] = useState(false);
  const [feeLoading, setFeeLoading] = useState(false);
  const [error, setError] = useState("");

  // =====================================================
  // Protect checkout when cart is empty
  // =====================================================

  useEffect(() => {
    if (cart.length === 0) {
      navigate("/restaurants");
    }
  }, [cart, navigate]);

  // =====================================================
  // Calculate delivery fee
  // =====================================================

  const calculateFee = async () => {
    try {
      setFeeLoading(true);
      setError("");

      const [lng, lat] = coordinates;

      const response = await api.get(
        "/orders/calculate-delivery-fee",
        {
          params: {
            lng,
            lat,
          },
        }
      );

      console.log(
        "Delivery fee response:",
        response.data
      );

      if (response.data?.fee !== undefined) {
        setDeliveryFee(response.data.fee);
      } else {
        setDeliveryFee(null);
      }
    } catch (err) {
      console.error(
        "Delivery fee error:",
        err
      );

      setDeliveryFee(null);

      setError(
        err.response?.data?.message ||
          "Unable to calculate delivery fee."
      );
    } finally {
      setFeeLoading(false);
    }
  };

  // =====================================================
  // Calculate fee when checkout opens
  // =====================================================

  useEffect(() => {
    if (cart.length > 0) {
      calculateFee();
    }
  }, []);

  // =====================================================
  // Total
  // =====================================================

  const totalAmount =
    subtotal + (deliveryFee ?? 0);

  // =====================================================
  // Place Order
  // =====================================================

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    console.log("PLACE ORDER BUTTON CLICKED");

    setError("");

    // Address validation
    if (!address.trim()) {
      setError(
        "Please enter your delivery address."
      );
      return;
    }

    // Cart validation
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    // Delivery fee validation
    if (deliveryFee === null) {
      setError(
        "Please calculate the delivery fee before placing the order."
      );
      return;
    }

    // =================================================
    // One restaurant per order
    // =================================================

    const restaurantId =
      cart[0].restaurantId;

    const differentRestaurant =
      cart.some(
        (item) =>
          item.restaurantId !== restaurantId
      );

    if (differentRestaurant) {
      setError(
        "Please order items from only one restaurant at a time."
      );
      return;
    }

    try {
      setLoading(true);

      // =================================================
      // Prepare order items
      // =================================================

      const orderItems = cart.map(
        (item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })
      );

      // =================================================
      // Create order
      // =================================================

      console.log("Creating order:", {
        restaurantId,
        items: orderItems,
        deliveryLocation: {
          type: "Point",
          coordinates,
        },
      });

      const response = await api.post(
        "/orders/create",
        {
          restaurantId,

          items: orderItems,

          deliveryLocation: {
            type: "Point",
            coordinates,
          },
        }
      );

      console.log(
        "Create order response:",
        response.data
      );

      // =================================================
      // Get created order
      // =================================================

      const createdOrder =
        response.data?.order;

      if (!createdOrder?._id) {
        throw new Error(
          "Order was created but order ID was not returned."
        );
      }

      console.log(
        "Created Order ID:",
        createdOrder._id
      );

      // =================================================
      // Clear cart
      // =================================================

      clearCart();

      // =================================================
      // Navigate to Order Details
      // =================================================

      navigate(
        `/orders/${createdOrder._id}`
      );

    } catch (err) {
      console.error(
        "Create order error:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to place order. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // Empty cart protection
  // =====================================================

  if (cart.length === 0) {
    return null;
  }

  return (
    <div className="checkout-page">

      {/* =================================================
          Header
      ================================================= */}

      <header className="restaurant-header">

        <div
          className="logo"
          onClick={() =>
            navigate("/restaurants")
          }
          style={{
            cursor: "pointer",
          }}
        >
          🍔 FoodDelivery
        </div>

        <button
          onClick={() =>
            navigate("/cart")
          }
        >
          ← Back to Cart
        </button>

      </header>

      {/* =================================================
          Main
      ================================================= */}

      <main className="checkout-container">

        <div className="checkout-content">

          {/* =================================================
              Delivery Details
          ================================================= */}

          <section className="checkout-section">

            <h1>Checkout</h1>

            <h2>
              Delivery Details
            </h2>

            <form
              onSubmit={handlePlaceOrder}
            >

              {/* Address */}

              <label>
                Delivery Address
              </label>

              <textarea
                value={address}
                onChange={(e) =>
                  setAddress(
                    e.target.value
                  )
                }
                placeholder="Enter your delivery address"
                rows="4"
              />

              {/* Longitude */}

              <label>
                Longitude
              </label>

              <input
                type="number"
                step="any"
                value={coordinates[0]}
                onChange={(e) =>
                  setCoordinates([
                    Number(
                      e.target.value
                    ),
                    coordinates[1],
                  ])
                }
              />

              {/* Latitude */}

              <label>
                Latitude
              </label>

              <input
                type="number"
                step="any"
                value={coordinates[1]}
                onChange={(e) =>
                  setCoordinates([
                    coordinates[0],
                    Number(
                      e.target.value
                    ),
                  ])
                }
              />

              {/* Calculate Fee */}

              <button
                type="button"
                onClick={calculateFee}
                disabled={feeLoading}
              >
                {feeLoading
                  ? "Calculating..."
                  : "Calculate Delivery Fee"}
              </button>

              {/* Error */}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {/* Place Order */}

              <button
                type="submit"
                className="checkout-button"
                disabled={
                  loading ||
                  feeLoading ||
                  deliveryFee === null
                }
              >
                {loading
                  ? "Placing Order..."
                  : deliveryFee === null
                  ? "Calculate Delivery Fee First"
                  : `Place Order • ₹${totalAmount}`}
              </button>

            </form>

          </section>

          {/* =================================================
              Order Summary
          ================================================= */}

          <section className="checkout-summary">

            <h2>
              Order Summary
            </h2>

            <p>
              Restaurant:{" "}
              <strong>
                {cart[0]?.restaurantName}
              </strong>
            </p>

            {/* Items */}

            <div className="checkout-items">

              {cart.map((item) => (

                <div
                  className="checkout-item"
                  key={`${item.restaurantId}-${item.itemId}`}
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
                    {item.price *
                      item.quantity}
                  </strong>

                </div>

              ))}

            </div>

            <hr />

            {/* Subtotal */}

            <div className="summary-row">

              <span>
                Subtotal
              </span>

              <span>
                ₹{subtotal}
              </span>

            </div>

            {/* Delivery Fee */}

            <div className="summary-row">

              <span>
                Delivery Fee
              </span>

              <span>
                {feeLoading
                  ? "Calculating..."
                  : deliveryFee === null
                  ? "Not calculated"
                  : deliveryFee === 0
                  ? "FREE"
                  : `₹${deliveryFee}`}
              </span>

            </div>

            <hr />

            {/* Total */}

            <div className="summary-total">

              <span>
                Total
              </span>

              <strong>
                ₹{totalAmount}
              </strong>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
};

export default Checkout;