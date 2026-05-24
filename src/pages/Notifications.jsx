import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react';

function Notifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
    }
  }, [profile?.id]);

  async function fetchNotifications() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }

  async function handleNotificationClick(notification) {
    try {
      if (!notification.is_read) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);

        setNotifications(notifications.map(n =>
          n.id === notification.id ? { ...n, is_read: true } : n
        ));
      }

      if (notification.link) {
        navigate(notification.link);
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  }

  async function deleteNotification(e, notificationId) {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }

  function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسبوع`;
    return `منذ ${Math.floor(diffDays / 30)} شهر`;
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'info':
        return <Info size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'danger':
        return <AlertCircle size={18} />;
      case 'success':
        return <CheckCircle size={18} />;
      default:
        return <Info size={18} />;
    }
  }

  function getNotificationIconClass(type) {
    switch (type) {
      case 'info':
        return 'notif-icon' + ' ' + 'info';
      case 'warning':
        return 'notif-icon' + ' ' + 'warning';
      case 'danger':
        return 'notif-icon' + ' ' + 'danger';
      case 'success':
        return 'notif-icon' + ' ' + 'success';
      default:
        return 'notif-icon' + ' ' + 'info';
    }
  }

  function getIconStyle(type) {
    const styles = {
      info: { background: 'var(--info-bg)', color: 'var(--info-light)' },
      warning: { background: 'var(--warning-bg)', color: 'var(--warning-light)' },
      danger: { background: 'var(--danger-bg)', color: 'var(--danger-light)' },
      success: { background: 'var(--success-bg)', color: 'var(--success-light)' }
    };
    return styles[type] || styles.info;
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="loading-inline">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning-light)' }}>
            <Bell size={28} />
          </span>
          الإشعارات
          {unreadCount > 0 && (
            <span className="badge badge-danger">{unreadCount} جديد</span>
          )}
        </h1>
        <div className="page-actions">
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={markAllAsRead}>
              <CheckCheck size={18} />
              تحديد الكل كمقروء
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {notifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔔</div>
              <h3>لا توجد إشعارات</h3>
              <p>ستظهر الإشعارات الجديدة هنا</p>
            </div>
          ) : (
            <div>
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notif-icon" style={getIconStyle(notification.type)}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">{notification.title}</div>
                    <div className="notif-message">{notification.message}</div>
                    <div className="notif-time">{getTimeAgo(notification.created_at)}</div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => deleteNotification(e, notification.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Notifications;
