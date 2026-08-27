import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";

const Cart = () => {
  const navigate = useNavigate();

  const {
    cart,
    removeFromCart,
    updateQuantity,
    subtotal,
    clearCart,
  } = useCart();

  const deliveryFee = subtotal >= 300 ? 0 : 45;
  const totalAmount = subtotal + deliveryFee;

  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <header className="restaurant-header">
          <div
            className="logo"
            onClick={() => navigate("/restaurants")}
          >
            🍔 FoodDelivery
          </div>

          <button onClick={() => navigate("/restaurants")}>
            ← Restaurants
          </button>
        </header>

        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>

          <h1>Your Cart is Empty</h1>

          <p>
            Add some delicious food from a restaurant.
          </p>

          <button
            className="primary-button"
            onClick={() => navigate("/restaurants")}
          >
            Browse Restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      {/* Header */}
      <header className="restaurant-header">
        <div
          className="logo"
          onClick={() => navigate("/restaurants")}
        >
          🍔 FoodDelivery
        </div>

        <button onClick={() => navigate("/restaurants")}>
          ← Continue Shopping
        </button>
      </header>

      <main className="cart-container">
        <div className="cart-header">
          <div>
            <h1>Your Cart</h1>

            <p>
              {cart.reduce(
                (total, item) => total + item.quantity,
                0
              )}{" "}
              item(s)
            </p>
          </div>

          <button
            className="clear-cart-button"
            onClick={clearCart}
          >
            Clear Cart
          </button>
        </div>

        {/* Cart Items */}
        <div className="cart-items">
          {cart.map((item) => (
            <div
              className="cart-item"
              key={`${item.restaurantId}-${item.itemId}`}
            >
              <div className="cart-item-info">
                <h3>{item.name}</h3>

                <p>{item.restaurantName}</p>

                <span>₹{item.price} each</span>

                {item.isVeg && (
                  <span className="veg-badge">
                    Veg
                  </span>
                )}
              </div>

              <div className="cart-item-actions">
                <div className="quantity-control">
                  <button
                    onClick={() =>
                      updateQuantity(
                        item.restaurantId,
                        item.itemId,
                        item.quantity - 1
                      )
                    }
                  >
                    −
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    onClick={() =>
                      updateQuantity(
                        item.restaurantId,
                        item.itemId,
                        item.quantity + 1
                      )
                    }
                  >
                    +
                  </button>
                </div>

                <strong>
                  ₹{item.price * item.quantity}
                </strong>

                <button
                  className="remove-button"
                  onClick={() =>
                    removeFromCart(
                      item.restaurantId,
                      item.itemId
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="cart-summary">
          <h2>Order Summary</h2>

          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>

          <div className="summary-row">
            <span>Delivery Fee</span>

            <span>
              {deliveryFee === 0
                ? "FREE"
                : `₹${deliveryFee}`}
            </span>
          </div>

          <hr />

          <div className="summary-total">
            <span>Total</span>
            <strong>₹{totalAmount}</strong>
          </div>

          <button
            className="checkout-button"
            onClick={() => navigate("/checkout")}
          >
            Proceed to Checkout
          </button>
        </div>
      </main>
    </div>
  );
};

export default Cart;