import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Trash2,
  Check,
  UserPlus,
  AlertTriangle,
  Coins,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Notification {
  id: string;
  type: string;
  payload: {
    extension_request_id?: string;
    task_id?: string;
    task_title?: string;
    task_type?: string;
    priority?: string;
    due_date?: string;
    requester_name?: string;
    decider_name?: string;
    decision_note?: string;
    status?: string;
    assigned_by?: string;
    assigner_name?: string;
    hours_until_due?: number;
    points?: number;
    reason_code?: string;
    project_id?: string;
    project_name?: string;
    new_member_id?: string;
    new_member_name?: string;
    member_role?: string;
    organization_id?: string;
    organization_name?: string;
    message: string;
  };
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { organization } = useOrganization();

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      subscribeToNotifications();
    }
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []) as unknown as Notification[]);
      setUnreadCount((data || []).filter((n) => !n.read_at).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          toast({
            title: "New Notification",
            description: newNotification.payload.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const notification = notifications.find((n) => n.id === notificationId);
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.read_at) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "extension_requested":
        return <CalendarClock className="w-5 h-5 text-primary dark:text-primary" />;
      case "extension_approved":
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case "extension_rejected":
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case "task_assigned":
        return <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case "task_due_reminder":
        return <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      case "points_earned":
        return <Coins className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      case "member_joined":
        return <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "extension_requested":
        return "bg-primary/10 border-primary/20 dark:bg-primary/20 dark:border-primary/30";
      case "extension_approved":
        return "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800/50";
      case "extension_rejected":
        return "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800/50";
      case "task_assigned":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800/50";
      case "task_due_reminder":
        return "bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800/50";
      case "points_earned":
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800/50";
      case "member_joined":
        return "bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800/50";
      default:
        return "bg-muted/50 border-muted dark:bg-muted dark:border-muted";
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    // Mark as read, close popover, then navigate
    await markAsRead(n.id);
    setIsOpen(false);

    const role = organization?.role;
    if (!role) return;

    // Route based on notification type
    if (n.type === "extension_requested") {
      navigate(`/${role}/extension-requests?tab=pending`);
      return;
    }
    if (n.type === "extension_approved") {
      navigate(`/${role}/extension-requests?tab=approved`);
      return;
    }
    if (n.type === "extension_rejected") {
      navigate(`/${role}/extension-requests?tab=rejected`);
      return;
    }

    // For task-related notifications, navigate to the project detail page
    if (n.type === "task_assigned" || n.type === "task_due_reminder") {
      if (n.payload.task_id) {
        try {
          // Fetch the task to get the project_id and task_type
          const { data: taskData, error: taskError } = await supabase
            .from("tasks")
            .select("project_id, task_type")
            .eq("id", n.payload.task_id)
            .single();

          if (taskError || !taskData?.project_id) {
            console.error("Error fetching task:", taskError);
            // Fallback to general projects page
            navigateToFallbackProjectPage(role);
            return;
          }

          // Fetch the project to get its name
          const { data: projectData, error: projectError } = await supabase
            .from("projects")
            .select("name")
            .eq("id", taskData.project_id)
            .single();

          if (projectError || !projectData?.name) {
            console.error("Error fetching project:", projectError);
            // Fallback to general projects page
            navigateToFallbackProjectPage(role);
            return;
          }

          // Determine which tab to show based on task_type
          // task_type 'assignment' -> assignments tab, otherwise -> tasks tab
          const tab = taskData.task_type === 'assignment' ? 'assignments' : 'tasks';

          // Navigate to the specific project detail page with the correct tab
          navigate(`/${role}/projects/${encodeURIComponent(projectData.name)}?tab=${tab}`);
        } catch (error) {
          console.error("Error navigating to project:", error);
          // Fallback to general projects page
          navigateToFallbackProjectPage(role);
        }
      } else {
        // No task_id available, fallback to general page
        navigateToFallbackProjectPage(role);
      }
      return;
    }

    // For points earned notifications, navigate to shop
    if (n.type === "points_earned") {
      navigate(`/${role}/shop`);
      return;
    }

    // For member joined notifications, navigate to team management
    if (n.type === "member_joined") {
      if (role === "owner") {
        navigate("/owner/team");
      } else if (role === "admin") {
        navigate("/admin/manage-team");
      }
      return;
    }
  };

  const navigateToFallbackProjectPage = (role: string) => {
    // Fallback navigation if we can't find the project
    if (role === "employee") {
      navigate(`/employee/projects`);
    } else if (role === "supervisor") {
      navigate(`/supervisor/projects`);
    } else if (role === "admin") {
      navigate(`/admin/task-assignment`);
    } else if (role === "owner") {
      navigate(`/owner/task-assignment`);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BellOff className="w-12 h-12 mb-2 opacity-50" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors cursor-pointer",
                    !notification.read_at
                      ? getNotificationColor(notification.type)
                      : "bg-background border-border opacity-60"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1 text-foreground dark:text-foreground">
                        {notification.payload.message}
                      </p>
                      {notification.payload.decision_note && (
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-2 italic">
                          Note: {notification.payload.decision_note}
                        </p>
                      )}
                      {notification.payload.task_type && (
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-1">
                          Type: {notification.payload.task_type === 'assignment' ? 'Assignment' : 'Task'}
                          {notification.payload.priority && ` • Priority: ${notification.payload.priority}`}
                        </p>
                      )}
                      {notification.payload.due_date && (
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-1">
                          Due: {new Date(notification.payload.due_date).toLocaleDateString()}
                        </p>
                      )}
                      {notification.payload.points && (
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground mb-1 flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          <span>{notification.payload.points} points earned</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.read_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

