import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../context/CartContext";

const RestaurantDetails = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();

  // Cart
  const { addToCart, cartCount } = useCart();

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/restaurants/${restaurantId}`
        );

        setRestaurant(response.data);
      } catch (err) {
        console.error("Restaurant details error:", err);

        setError(
          err.response?.data?.message ||
            "Unable to load restaurant."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId]);

  // Loading
  if (loading) {
    return (
      <div className="loading-page">
        <h2>Loading restaurant...</h2>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="error-page">
        <h2>{error}</h2>

        <button
          onClick={() => navigate("/restaurants")}
        >
          Back to Restaurants
        </button>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div className="restaurant-details-page">

      {/* ================= HEADER ================= */}

      <header className="restaurant-header">

        {/* Logo */}
        <div
          className="logo"
          onClick={() => navigate("/restaurants")}
          style={{ cursor: "pointer" }}
        >
          🍔 FoodDelivery
        </div>

        {/* Header Actions */}
        <div className="header-actions">

          {/* Back */}
          <button
            onClick={() => navigate("/restaurants")}
          >
            ← Back
          </button>

          {/* Cart */}
          <button
            onClick={() => navigate("/cart")}
          >
            🛒 Cart ({cartCount})
          </button>

        </div>
      </header>

      {/* ================= RESTAURANT HERO ================= */}

      <section className="restaurant-hero">

        {/* Restaurant Image */}
        <div className="restaurant-hero-image">

          {restaurant.image ? (
            <img
              src={restaurant.image}
              alt={restaurant.name}
            />
          ) : (
            <div className="large-placeholder">
              🍽️
            </div>
          )}

        </div>

        {/* Restaurant Information */}
        <div className="restaurant-hero-content">

          <h1>{restaurant.name}</h1>

          <p>
            {Array.isArray(restaurant.cuisine)
              ? restaurant.cuisine.join(" • ")
              : restaurant.cuisine || "Various Cuisine"}
          </p>

          {/* Restaurant Info */}
          <div className="hero-info">

            <span>
              ⭐ {restaurant.rating ?? "New"}
            </span>

            {restaurant.avgDeliveryTime && (
              <span>
                🕐 {restaurant.avgDeliveryTime} min
              </span>
            )}

            {restaurant.priceRange && (
              <span>
                💰 {restaurant.priceRange}
              </span>
            )}

          </div>

          {/* Veg Badge */}
          {restaurant.isVeg && (
            <span className="veg-badge">
              Pure Veg
            </span>
          )}

        </div>

      </section>

      {/* ================= MENU ================= */}

      <main className="menu-container">

        <div className="menu-header">

          <div>
            <h2>Menu</h2>

            <p>
              {restaurant.menu?.length || 0} items available
            </p>
          </div>

          {/* Cart button */}
          <button
            onClick={() => navigate("/cart")}
          >
            🛒 View Cart ({cartCount})
          </button>

        </div>

        {/* No Menu */}
        {!restaurant.menu ||
        restaurant.menu.length === 0 ? (
          <div className="empty-state">

            <h3>Menu unavailable</h3>

            <p>
              This restaurant currently has no menu items.
            </p>

          </div>
        ) : (

          /* Menu Items */
          <div className="menu-grid">

            {restaurant.menu.map((item, index) => (

              <div
                className="menu-card"
                key={item._id || index}
              >

                {/* Item Information */}
                <div className="menu-info">

                  <h3>{item.name}</h3>

                  <p className="menu-price">
                    ₹{item.price}
                  </p>

                  {item.isVeg && (
                    <span className="veg-badge">
                      Veg
                    </span>
                  )}

                </div>

                {/* Add Button */}
                <button
                  onClick={() => {
                    addToCart(restaurant, item);
                  }}
                >
                  + Add
                </button>

              </div>

            ))}

          </div>
        )}

      </main>

      {/* ================= FLOATING CART ================= */}

      {cartCount > 0 && (
        <div className="floating-cart">

          <button
            onClick={() => navigate("/cart")}
          >
            🛒 View Cart ({cartCount})
          </button>

        </div>
      )}

    </div>
  );
};

export default RestaurantDetails;