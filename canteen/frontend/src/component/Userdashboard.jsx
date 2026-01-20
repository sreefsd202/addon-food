import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Userdashboard.css';
import { useNavigate } from 'react-router-dom';

const Userdashboard = ({ user, setUser }) => {
  const navigate = useNavigate();
  
  // Food Ordering States
  const [foodItems, setFoodItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [orderDetails, setOrderDetails] = useState({
    token: '',
    paymentId: '',
    totalAmount: 0,
    paymentMethod: ''
  });
  const [orderHistory, setOrderHistory] = useState([]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('menu');

  // Redirect if user is not logged in
  useEffect(() => {
    if (!user) {
      navigate('/user/login');
    }
  }, [user, navigate]);

  // Show loading while checking user authentication
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>Loading Dashboard...</h2>
        <p>Please wait while we verify your session.</p>
      </div>
    );
  }

  // Fetch food items and orders on component mount
  useEffect(() => {
    if (user) {
      fetchFoodItems();
      fetchOrderHistory();
    }
  }, [user]);

  // Calculate total whenever cart changes
  useEffect(() => {
    const total = cart.reduce((sum, item) => {
      return sum + (item.price * item.quantityInCart);
    }, 0);
    setTotalAmount(total);
  }, [cart]);

  // ================= FOOD ORDERING FUNCTIONS =================
  const fetchFoodItems = async () => {
    try {
      const res = await axios.get("http://localhost:5000/menu");
      setFoodItems(res.data);
    } catch (err) {
      console.error("Failed to fetch menu items:", err);
    }
  };

  const fetchOrderHistory = async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/orders/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrderHistory(response.data);
    } catch (error) {
      console.error('Error fetching order history:', error);
    }
  };

  const generateToken = () => {
    const chars = '0123456789';
    let token = '';
    for (let i = 0; i < 3; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const generatePaymentId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PAY${timestamp}${random}`;
  };

  const handleAddToCart = (item) => {
    // Check if item is in stock
    if (item.quantity <= 0) {
      alert("This item is out of stock!");
      return;
    }
    
    const existingItem = cart.find(cartItem => cartItem._id === item._id);
    
    if (existingItem) {
      if (existingItem.quantityInCart >= item.quantity) {
        alert(`Only ${item.quantity} items available in stock!`);
        return;
      }
      setCart(cart.map(cartItem => 
        cartItem._id === item._id 
          ? { ...cartItem, quantityInCart: cartItem.quantityInCart + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantityInCart: 1 }]);
    }
  };

  const handleRemoveFromCart = (itemId) => {
    const existingItem = cart.find(item => item._id === itemId);
    
    if (existingItem.quantityInCart > 1) {
      setCart(cart.map(cartItem => 
        cartItem._id === itemId 
          ? { ...cartItem, quantityInCart: cartItem.quantityInCart - 1 }
          : cartItem
      ));
    } else {
      setCart(cart.filter(item => item._id !== itemId));
    }
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    if (paymentMethod === 'online') {
      handleOnlinePayment();
    } else {
      handleCashPayment();
    }
  };

  const handleCashPayment = async () => {
    setIsProcessingPayment(true);
    
    try {
      const orderToken = generateToken();
      const cashPaymentId = generatePaymentId();
      const token = localStorage.getItem('token');
      
      // Validate token exists
      if (!token) {
        alert("Authentication token missing. Please login again.");
        navigate('/user/login');
        setIsProcessingPayment(false);
        return;
      }
      
      // Create order data - backend will handle stock decrement
      const orderData = {
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantityInCart,
          itemId: item._id
        })),
        totalAmount: totalAmount,
        paymentMethod: 'cash'
      };
      
      console.log("Creating cash order:", orderData);
      
      // Send order to backend
      const orderRes = await axios.post(
        'http://localhost:5000/orders/create', 
        orderData, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Cash order response:", orderRes.data);
      
      setOrderDetails({
        token: orderRes.data.orderToken || orderToken,
        paymentId: orderRes.data.paymentId || cashPaymentId,
        totalAmount: totalAmount,
        paymentMethod: 'cash'
      });
      
      setShowSuccessPopup(true);
      setCart([]);
      fetchOrderHistory();
      fetchFoodItems(); // Refresh menu to show updated stock
      
    } catch (error) {
      console.error("Order processing error:", error);
      console.error("Error response:", error.response?.data);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert("Authentication failed. Please login again.");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/user/login');
      } else {
        alert(`Order processing failed: ${error.response?.data?.error || 'Please contact support'}`);
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleOnlinePayment = async () => {
    setIsProcessingPayment(true);
    
    try {
      const orderToken = generateToken();
      const paymentId = generatePaymentId();
      const token = localStorage.getItem('token');
      
      // Validate token exists
      if (!token) {
        alert("Authentication token missing. Please login again.");
        navigate('/user/login');
        setIsProcessingPayment(false);
        return;
      }
      
      alert(`✅ Payment Successful!\n\nProcessing your order...`);
      
      // Create order data - backend will handle stock decrement
      const orderData = {
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantityInCart,
          itemId: item._id
        })),
        totalAmount: totalAmount,
        paymentMethod: 'online'
      };
      
      console.log("Sending order data:", orderData);
      
      // Send order to backend
      const orderRes = await axios.post(
        'http://localhost:5000/orders/create', 
        orderData, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Order response:", orderRes.data);
      
      setOrderDetails({
        token: orderRes.data.orderToken || orderToken,
        paymentId: orderRes.data.paymentId || paymentId,
        totalAmount: totalAmount,
        paymentMethod: 'online'
      });
      
      setShowSuccessPopup(true);
      setCart([]);
      fetchOrderHistory();
      fetchFoodItems(); // Refresh menu to show updated stock
      
    } catch (error) {
      console.error("Order processing error:", error);
      console.error("Error response:", error.response?.data);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert("Authentication failed. Please login again.");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/user/login');
      } else if (error.response?.status === 400) {
        alert(`Order error: ${error.response.data.error || 'Invalid order data'}`);
      } else {
        alert("Payment successful but order processing failed. Please contact support.");
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
  };

  const handleCancelOrder = async (orderId, orderStatus) => {
    if (orderStatus === 'ready' || orderStatus === 'collected') {
      alert("Cannot cancel this order. It's already ready or collected.");
      return;
    }

    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this order? The stock will be restored."
    );

    if (!confirmCancel) return;

    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.put(
        `http://localhost:5000/api/orders/${orderId}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        alert("✅ Order cancelled successfully! Stock has been restored.");
        fetchOrderHistory();
        fetchFoodItems();
      }
    } catch (error) {
      console.error("Cancel order error:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.error || "Cannot cancel this order.");
      } else {
        alert("Failed to cancel order. Please try again or contact support.");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/user/login');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotalSpent = () => {
    return orderHistory.reduce((total, order) => total + order.totalAmount, 0);
  };

  const getUserInitials = () => {
    if (!user || !user.name) return '??';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  const filteredFoodItems = foodItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Continue in Part 2...
  // ================= RENDER FUNCTIONS =================
  
  const renderNavbar = () => (
    <nav className="user-navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h2>🍔 CampusBites</h2>
        </div>
        
        <div className="navbar-menu">
          <button 
            className={`nav-tab ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            🍽️ Menu
          </button>
          <button 
            className={`nav-tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📋 My Orders
          </button>
          <button 
            className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
        </div>

        <div className="navbar-user">
          <div className="user-info" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
            <div className="user-avatar">
              {getUserInitials()}
            </div>
            <span className="user-name">{user.name}</span>
            <span className="dropdown-icon">▼</span>
          </div>
          
          {isUserMenuOpen && (
            <div className="user-dropdown">
              <div className="dropdown-item" onClick={() => setActiveTab('profile')}>
                👤 Profile
              </div>
              <div className="dropdown-item" onClick={handleLogout}>
                🚪 Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  const renderFoodMenu = () => (
    <div className="menu-section">
      <div className="menu-header">
        <h2 className="dashboard-title">Browse Our Menu 🍽️</h2>
        <p className="menu-subtitle">Choose your favorite dishes and add them to cart</p>
      </div>

      <div className="menu-controls">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search for food items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="menu-container">
        <div className="menu-grid">
          {filteredFoodItems.length === 0 ? (
            <div className="no-items-message">
              <div className="no-items-icon">🔍</div>
              <h4>No items found</h4>
              <p>Try adjusting your search</p>
            </div>
          ) : (
            filteredFoodItems.map((item) => {
              const cartItem = cart.find(c => c._id === item._id);
              const quantityInCart = cartItem ? cartItem.quantityInCart : 0;

              return (
                <div key={item._id} className="menu-card">
                  <img
                    src={item.image || 'https://via.placeholder.com/300x200?text=Food+Image'}
                    alt={item.name}
                    className="menu-item-image"
                  />
                  <div className="menu-card-content">
                    <div className="menu-item-header">
                      <h3 className="menu-item-name">{item.name}</h3>
                      <span className="menu-item-category">{item.category || 'Food'}</span>
                    </div>

                    <p className="menu-item-price">₹{item.price}</p>

                    <div className={`menu-item-stock ${item.quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                      {item.quantity > 0 ? `In Stock (${item.quantity})` : 'Out of Stock'}
                    </div>

                    <div className="order-controls">
                      {quantityInCart === 0 ? (
                        <button
                          className="add-to-cart-btn"
                          onClick={() => handleAddToCart(item)}
                          disabled={item.quantity <= 0}
                        >
                          <span className="cart-icon">🛒</span>
                          Add to Cart
                        </button>
                      ) : (
                        <div className="quantity-controls">
                          <button
                            className="qty-btn"
                            onClick={() => handleRemoveFromCart(item._id)}
                          >
                            −
                          </button>
                          <span className="qty-display">{quantityInCart}</span>
                          <button
                            className="qty-btn"
                            onClick={() => handleAddToCart(item)}
                            disabled={quantityInCart >= item.quantity}
                          >
                            +
                          </button>
                          <span className="item-total-price">
                            ₹{(item.price * quantityInCart).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="cart-summary">
          <div className="cart-header">
            <h3>
              <span className="cart-icon">🛒</span> Your Cart
            </h3>
            <span className="item-count">{cart.length} items</span>
          </div>

          {cart.map((item) => (
            <div key={item._id} className="cart-item">
              <span className="cart-item-name">{item.name}</span>
              <div className="cart-item-controls">
                <button
                  className="cart-btn minus"
                  onClick={() => handleRemoveFromCart(item._id)}
                >
                  −
                </button>
                <span className="cart-item-qty">{item.quantityInCart}</span>
                <button
                  className="cart-btn plus"
                  onClick={() => handleAddToCart(item)}
                  disabled={item.quantityInCart >= item.quantity}
                >
                  +
                </button>
                <span className="cart-item-price">
                  ₹{(item.price * item.quantityInCart).toFixed(2)}
                </span>
              </div>
            </div>
          ))}

          <div className="cart-total-section">
            <div className="payment-method-selector">
              <h4>Payment Method</h4>
              <div className="payment-options">
                <label className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    checked={paymentMethod === 'online'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <span className="payment-label">💳 Online Payment</span>
                </label>
                <label className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <span className="payment-label">💰 Cash on Counter</span>
                </label>
              </div>
            </div>

            <div className="checkout-section">
              <div className="total-amount">
                <h4>Total: ₹{totalAmount.toFixed(2)}</h4>
                {paymentMethod === 'cash' && (
                  <p className="cash-note">Pay at counter when collecting</p>
                )}
              </div>
              <button
                className="checkout-btn"
                onClick={handlePlaceOrder}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <>
                    <span className="payment-processing">⏳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span>🛍️</span>
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderOrdersDashboard = () => (
    <div className="dashboard-section">
      <div className="dashboard-header">
        <h2 className="dashboard-title">My Orders 📋</h2>
        <div className="order-stats">
          <div className="stat-card">
            <div className="stat-value">{orderHistory.length}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">₹{calculateTotalSpent().toFixed(2)}</div>
            <div className="stat-label">Total Spent</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {orderHistory.filter(o => o.status === 'ready').length}
            </div>
            <div className="stat-label">Ready for Pickup</div>
          </div>
        </div>
      </div>

      {orderHistory.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Orders Yet</h3>
          <p>Start ordering delicious food from our menu!</p>
          <button className="start-ordering-btn" onClick={() => setActiveTab('menu')}>
            🍔 Browse Menu
          </button>
        </div>
      ) : (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date & Time</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Token</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderHistory.map((order) => (
                <tr key={order._id}>
                  <td className="order-id">{order._id.slice(-8)}</td>
                  <td className="order-date">{formatDate(order.createdAt)}</td>
                  <td className="order-items">
                    {order.items.slice(0, 2).map(item => item.name).join(', ')}
                    {order.items.length > 2 && ` +${order.items.length - 2} more`}
                  </td>
                  <td className="order-amount">₹{order.totalAmount}</td>
                  <td className={`order-status ${order.status}`}>
                    {order.status === 'ready' ? '✅ Ready' : 
                     order.status === 'preparing' ? '👨‍🍳 Preparing' : 
                     order.status === 'collected' ? '📦 Collected' : 
                     order.status === 'confirmed' ? '⏳ Confirmed' : '⏳ Pending'}
                  </td>
                  <td className="order-token">{order.orderToken || order.token || '---'}</td>
                  <td className="order-actions">
                    {(order.status === 'confirmed' || order.status === 'preparing') && (
                      <button 
                        className="cancel-order-btn"
                        onClick={() => handleCancelOrder(order._id, order.status)}
                      >
                        ❌ Cancel
                      </button>
                    )}
                    {(order.status === 'ready' || order.status === 'collected') && (
                      <span className="no-action-text">
                        {order.status === 'ready' ? '✓ Ready to collect' : '✓ Completed'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderProfileDashboard = () => (
    <div className="dashboard-section">
      <div className="dashboard-header">
        <h2 className="dashboard-title">My Profile 👤</h2>
      </div>

      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar-large">
              {getUserInitials()}
            </div>
            <div className="profile-info">
              <h3>{user.name}</h3>
              <p className="profile-email">{user.email}</p>
              <p className="profile-phone">📱 {user.phone}</p>
            </div>
          </div>

          <div className="profile-stats">
            <div className="profile-stat">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <div className="stat-number">{orderHistory.length}</div>
                <div className="stat-label">Total Orders</div>
              </div>
            </div>
            
            <div className="profile-stat">
              <div className="stat-icon">💰</div>
              <div className="stat-content">
                <div className="stat-number">₹{calculateTotalSpent().toFixed(2)}</div>
                <div className="stat-label">Total Spent</div>
              </div>
            </div>
            
            <div className="profile-stat">
              <div className="stat-icon">👑</div>
              <div className="stat-content">
                <div className="stat-number">Member</div>
                <div className="stat-label">Status</div>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button className="profile-action-btn logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>

        <div className="recent-orders-card">
          <h3>Recent Orders</h3>
          {orderHistory.length === 0 ? (
            <div className="no-recent-orders">
              <p>No recent orders</p>
              <button className="start-ordering-btn" onClick={() => setActiveTab('menu')}>
                Start Ordering
              </button>
            </div>
          ) : (
            <>
              <div className="recent-orders-list">
                {orderHistory.slice(0, 5).map(order => (
                  <div key={order._id} className="recent-order-item">
                    <div className="recent-order-info">
                      <span className="recent-order-id">Order #{order._id.slice(-6)}</span>
                      <span className="recent-order-date">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="recent-order-details">
                      <span className={`recent-order-status ${order.status}`}>
                        {order.status}
                      </span>
                      <span className="recent-order-amount">₹{order.totalAmount}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {orderHistory.length > 0 && (
                <button 
                  className="view-all-orders-btn"
                  onClick={() => setActiveTab('orders')}
                >
                  View All Orders →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="user-dashboard-container">
      {renderNavbar()}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="success-popup-overlay">
          <div className="success-popup-container">
            <div className="success-popup-content">
              <div className="success-popup-header">
                <h3 className="success-popup-title">🎉 Order Confirmed!</h3>
                <p className="success-popup-subtitle">Your order has been placed successfully</p>
              </div>
              
              <div className="order-details-card">
                <div className="order-detail-row">
                  <span className="detail-label">Order Token:</span>
                  <span className="detail-value token-value">{orderDetails.token}</span>
                </div>
                
                <div className="order-detail-row">
                  <span className="detail-label">Payment ID:</span>
                  <span className="detail-value payment-id">{orderDetails.paymentId}</span>
                </div>
                
                <div className="order-detail-row">
                  <span className="detail-label">Total Amount:</span>
                  <span className="detail-value amount-value">₹{orderDetails.totalAmount}</span>
                </div>
                
                <div className="order-detail-row">
                  <span className="detail-label">Payment Method:</span>
                  <span className="detail-value payment-method">
                    {orderDetails.paymentMethod === 'online' ? '💳 Online Payment' : '💰 Cash on Counter'}
                  </span>
                </div>
                
                <div className="order-detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value status-confirmed">Confirmed ✓</span>
                </div>
              </div>
              
              {orderDetails.paymentMethod === 'cash' && (
                <p className="cash-instruction">
                  💡 Please pay ₹{orderDetails.totalAmount} in cash when collecting your order
                </p>
              )}
              
              <button 
                className="success-popup-ok-btn"
                onClick={handleCloseSuccessPopup}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content based on Active Tab */}
      <div className="dashboard-content">
        {activeTab === 'menu' && renderFoodMenu()}
        {activeTab === 'orders' && renderOrdersDashboard()}
        {activeTab === 'profile' && renderProfileDashboard()}
      </div>
    </div>
  );
};

export default Userdashboard;