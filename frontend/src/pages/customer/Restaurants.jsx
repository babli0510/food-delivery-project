import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

const Restaurants = () => {
  const navigate = useNavigate();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const fetchRestaurants = async (query = "") => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/restaurants/search", {
        params: query ? { q: query } : {},
      });

      setRestaurants(response.data.restaurants || []);
    } catch (err) {
      console.error("Restaurant fetch error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load restaurants."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRestaurants(search.trim());
  };

  return (
    <div className="restaurants-page">

      {/* Header */}
      <header className="restaurant-header">
        <div
          className="logo"
          onClick={() => navigate("/restaurants")}
        >
          🍔 FoodDelivery
        </div>

        <div className="header-actions">
          <button onClick={() => navigate("/orders")}>
            My Orders
          </button>

          <button onClick={() => navigate("/login")}>
            Logout
          </button>
        </div>
      </header>

      {/* Search Section */}
      <section className="restaurant-search">
        <h1>Find Your Favorite Food</h1>

        <p>
          Search restaurants, cuisines and dishes
        </p>

        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search restaurant or food..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button type="submit">
            Search
          </button>
        </form>
      </section>

      {/* Restaurant List */}
      <main className="restaurant-container">

        <div className="section-heading">
          <h2>Restaurants</h2>

          {!loading && (
            <span>
              {restaurants.length} restaurants found
            </span>
          )}
        </div>

        {loading && (
          <div className="loading">
            Loading restaurants...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!loading && !error && restaurants.length === 0 && (
          <div className="empty-state">
            <h3>No restaurants found</h3>
            <p>Try another search.</p>
          </div>
        )}

        {!loading && restaurants.length > 0 && (
          <div className="restaurant-grid">

            {restaurants.map((restaurant) => (
              <div
                className="restaurant-card"
                key={restaurant._id}
                onClick={() =>
                  navigate(`/restaurants/${restaurant._id}`)
                }
              >

                {/* Image */}
                <div className="restaurant-image">
                  {restaurant.image ? (
                    <img
                      src={restaurant.image}
                      alt={restaurant.name}
                    />
                  ) : (
                    <div className="image-placeholder">
                      🍽️
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="restaurant-details">

                  <h3>{restaurant.name}</h3>

                  <p className="cuisine">
                    {Array.isArray(restaurant.cuisine)
                      ? restaurant.cuisine.join(" • ")
                      : restaurant.cuisine || "Various"}
                  </p>

                  <div className="restaurant-info">

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

                  {restaurant.isVeg && (
                    <span className="veg-badge">
                      Pure Veg
                    </span>
                  )}

                </div>

              </div>
            ))}

          </div>
        )}

      </main>
    </div>
  );
};

export default Restaurants;