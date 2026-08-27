import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem("cart");
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Cart load error:", error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (restaurant, item) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) =>
          cartItem.restaurantId === restaurant._id &&
          cartItem.itemId === item._id
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.restaurantId === restaurant._id &&
          cartItem.itemId === item._id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
        );
      }

      return [
        ...currentCart,
        {
          restaurantId: restaurant._id,
          restaurantName: restaurant.name,
          itemId: item._id,
          name: item.name,
          price: item.price,
          quantity: 1,
          isVeg: item.isVeg,
        },
      ];
    });
  };

  const removeFromCart = (restaurantId, itemId) => {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          !(
            item.restaurantId === restaurantId &&
            item.itemId === itemId
          )
      )
    );
  };

  const updateQuantity = (restaurantId, itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(restaurantId, itemId);
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.restaurantId === restaurantId &&
        item.itemId === itemId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  return useContext(CartContext);
};