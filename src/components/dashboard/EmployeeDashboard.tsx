import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { OnlinePresence } from "./shared/OnlinePresence";
import { InvitationManager } from "./shared/InvitationManager";
import { ClockOutButton } from "./shared/ClockOutButton";
import { NotificationBell } from "./shared/NotificationBell";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Clock, 
  Target, 
  Users, 
  Trophy, 
  Coins, 
  Play, 
  Pause, 
  CheckCircle2,
  AlertTriangle,
  Flag,
  MessageSquare,
  Paperclip,
  ArrowRight,
  Star,
  Zap,
  LogOut,
  Settings,
  User,
  Gift,
  Wrench,
  FolderOpen,
  CalendarClock
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface OrganizationWithRole {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface Task extends Tables<"tasks"> {
  project: {
    name: string;
    organization_id: string;
  };
  phase?: {
    name: string;
  };
}

interface EmployeeDashboardProps {
  organization: OrganizationWithRole;
  onLogout: () => void;
  onClockOut: () => void;
}

const statusColors = {
  todo: "bg-muted",
  in_progress: "bg-primary",
  blocked: "bg-destructive",
  done: "bg-success",
};

const priorityColors = {
  low: "border-l-priority-low",
  medium: "border-l-priority-medium", 
  high: "border-l-priority-high",
  urgent: "border-l-priority-urgent",
};

export function EmployeeDashboard({ organization, onLogout, onClockOut }: EmployeeDashboardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [stats, setStats] = useState({
    ongoing: 0,
    totalProjects: 0,
    overdue: 0,
    completed: 0,
    points: 850,
    rank: 3,
    totalTeams: 0,
    isClockedIn: false,
    extensionRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUserId();
    fetchUserTasks();
    fetchUserStats();
  }, [organization.id]);

  const fetchUserTasks = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects!inner(name, organization_id),
          phase:phases(name)
        `)
        .eq("assignee_id", user.user?.id)
        .eq("project.organization_id", organization.id)
        .neq("status", "done")
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate task statistics
      const ongoing = tasks.filter(t => t.status === "in_progress").length;
      const overdue = tasks.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== "done";
      }).length;

      // Fetch projects count from the organization
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", organization.id);

      if (projectsError) throw projectsError;

      const totalProjects = projectsData?.length || 0;

      // Check if user is currently clocked in
      const { data: clockInData } = await supabase
        .from('attendance_checkins')
        .select('id, clock_out_at, local_date')
        .eq('user_id', user.id)
        .eq('local_date', new Date().toISOString().split('T')[0])
        .is('clock_out_at', null)
        .maybeSingle();

      const isClockedIn = !!clockInData;

      // Fetch extension requests count
      const { data: extensionRequestsData, error: extensionRequestsError } = await supabase
        .from("extension_requests")
        .select("id", { count: "exact" })
        .eq("requester_id", user.id)
        .eq("status", "pending");

      if (extensionRequestsError) {
        console.error("Error fetching extension requests:", extensionRequestsError);
      }

      const extensionRequests = extensionRequestsData?.length || 0;

      // Fetch teams count for the employee within this organization
      // @ts-ignore - team_members table will be available after migration
      const { data: teamMembersData, error: teamMembersError } = await (supabase as any)
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);

      if (teamMembersError) {
        console.error("Error fetching team members:", teamMembersError);
      }

      if (teamMembersData && teamMembersData.length > 0) {
        const teamIds = teamMembersData.map((tm: any) => tm.team_id);
        
        // Fetch teams and filter by organization
        // @ts-ignore - teams table will be available after migration
        const { data: teamsData, error: teamsError } = await (supabase as any)
          .from("teams")
          .select("id")
          .eq("organization_id", organization.id)
          .in("id", teamIds);

        if (teamsError) {
          console.error("Error fetching teams:", teamsError);
        }

        const totalTeams = teamsData?.length || 0;
        
        // Fetch actual points from points_ledger
        const { data: pointsData, error: pointsError } = await supabase
          .from("points_ledger")
          .select("delta")
          .eq("user_id", user.id);

        if (pointsError) throw pointsError;

        // Calculate total points (sum of all deltas - positive for earn, negative for spend)
        const totalPoints = (pointsData || []).reduce((sum, transaction) => {
          return sum + transaction.delta;
        }, 0);

        setStats(prev => ({
          ...prev,
          ongoing,
          totalProjects,
          overdue,
          points: totalPoints,
          isClockedIn,
          totalTeams,
          extensionRequests,
        }));
      } else {
        // No team memberships, continue with points fetch
        const { data: pointsData, error: pointsError } = await supabase
          .from("points_ledger")
          .select("delta")
          .eq("user_id", user.id);

        if (pointsError) throw pointsError;

        // Calculate total points (sum of all deltas - positive for earn, negative for spend)
        const totalPoints = (pointsData || []).reduce((sum, transaction) => {
          return sum + transaction.delta;
        }, 0);

        setStats(prev => ({
          ...prev,
          ongoing,
          totalProjects,
          overdue,
          points: totalPoints,
          isClockedIn,
          totalTeams: 0,
          extensionRequests,
        }));
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: "start" | "pause" | "complete") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let newStatus: TaskStatus;
      switch (action) {
        case "start":
          newStatus = "in_progress";
          break;
        case "pause":
          newStatus = "todo";
          break;
        case "complete":
          newStatus = "done";
          break;
      }

      // If completing a task, award points
      if (action === "complete") {
        // Get the task details to check for completion points
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("completion_points")
          .eq("id", taskId)
          .single();

        if (taskError) throw taskError;

        // Update task status
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);

        if (updateError) throw updateError;

        // Award points if the task has completion points
        if (taskData.completion_points && taskData.completion_points > 0) {
          const { error: pointsError } = await supabase
            .from("points_ledger")
            .insert({
              user_id: user.id,
              delta: taskData.completion_points,
              reason_code: "task_completion",
              task_id: taskId,
            });

          if (pointsError) throw pointsError;

          // Show success notification with points earned
          toast({
            title: "Task Completed! 🎉",
            description: `You earned ${taskData.completion_points} points!`,
          });
        } else {
          // Show completion message without points
          toast({
            title: "Task Completed!",
            description: "Great job completing this task!",
          });
        }
      } else {
        // For start and pause, just update the status
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);

        if (updateError) throw updateError;
      }

      // Create time log entry
      if (action === "start" || action === "pause" || action === "complete") {
        await supabase
          .from("time_logs")
          .insert({
            task_id: taskId,
            user_id: user.id,
            action: action === "complete" ? "complete" : action,
          });
      }

      // Small delay to ensure database transaction completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh data after completion
      await fetchUserTasks();
      await fetchUserStats();
      
      // Show success message if not already shown
      if (action !== "complete") {
        toast({
          title: "Task Updated",
          description: "Task status has been updated successfully",
        });
      }
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getActionButton = (task: Task) => {
    switch (task.status) {
      case "todo":
        return (
          <Button
            variant="start"
            size="sm"
            onClick={() => handleTaskAction(task.id, "start")}
          >
            <Play className="w-3 h-3" />
            Start
          </Button>
        );
      case "in_progress":
        return (
          <div className="flex gap-2">
            <Button
              variant="pause"
              size="sm"
              onClick={() => handleTaskAction(task.id, "pause")}
            >
              <Pause className="w-3 h-3" />
              Pause
            </Button>
            <Button
              variant="complete"
              size="sm"
              onClick={() => handleTaskAction(task.id, "complete")}
            >
              <CheckCircle2 className="w-3 h-3" />
              Complete
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const handleProjectsClick = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/employee/projects");
        return;
      }

      // First, check if we have any active tasks
      if (tasks.length > 0 && tasks[0].project?.name) {
        navigate(`/employee/projects/${tasks[0].project.name}`);
        return;
      }

      // If no active tasks, fetch all tasks (including completed) to find a project
      const { data: allTasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects!inner(name, organization_id)
        `)
        .eq("assignee_id", user.id)
        .eq("project.organization_id", organization.id)
        .eq("task_type", "task")
        .limit(1);

      if (tasksError) throw tasksError;

      if (allTasksData && allTasksData.length > 0 && allTasksData[0].project?.name) {
        navigate(`/employee/projects/${allTasksData[0].project.name}`);
      } else {
        // No tasks found, navigate to projects list
        navigate("/employee/projects");
      }
    } catch (error) {
      console.error("Error navigating to projects:", error);
      // Fallback to projects list on error
      navigate("/employee/projects");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={organization.logo_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {organization.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">{organization.name}</h1>
                <p className="text-sm text-muted-foreground">Employee Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {userId && <NotificationBell userId={userId} />}
              <Link to="/employee/shop">
                <Card variant="points" padding="sm" className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
                  <Coins className="w-5 h-5" />
                  <span className="font-semibold">{stats.points}</span>
                </Card>
              </Link>
              <ModeToggle />
              <ClockOutButton 
                organizationId={organization.id}
                organizationName={organization.name}
                onClockOut={onClockOut}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link to="/employee/time-management" className="group">
            <Card variant="interactive">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                    <p className={`text-2xl font-bold ${stats.isClockedIn ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {stats.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                    </p>
                  </div>
                  <div className={`w-12 h-12 ${stats.isClockedIn ? 'bg-green-500/10' : 'bg-muted/50'} rounded-lg flex items-center justify-center`}>
                    <Clock className={`w-6 h-6 ${stats.isClockedIn ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/employee/projects" className="group">
            <Card variant="interactive">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Projects</p>
                    <p className="text-2xl font-bold">{stats.totalProjects}</p>
                  </div>
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/employee/extension-requests" className="group">
            <Card variant="interactive">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Extension Requests</p>
                    <p className="text-2xl font-bold">{stats.extensionRequests}</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <CalendarClock className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/employee/teams" className="group">
            <Card variant="interactive">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Teams</p>
                    <p className="text-2xl font-bold">{stats.totalTeams}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Employee Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Quick Tools
                </CardTitle>
                <CardDescription>
                  Fast and easy access to your work
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleProjectsClick}>
                    <FolderOpen className="w-6 h-6" />
                    <span>Tasks</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/employee/teams">
                      <Users className="w-6 h-6" />
                      <span>Teams</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/employee/time-management">
                      <Clock className="w-6 h-6" />
                      <span>Logging History</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/employee/extension-requests">
                      <CalendarClock className="w-6 h-6" />
                      <span>Extension Requests</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/employee/my-rewards">
                      <Trophy className="w-6 h-6" />
                      <span>My Rewards</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/employee/shop">
                      <Gift className="w-6 h-6" />
                      <span>Rewards Shop</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  My Ongoing Tasks
                </CardTitle>
                <CardDescription>
                  {tasks.length} active task{tasks.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active tasks assigned</p>
                    <p className="text-sm">Great job staying on top of everything!</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <Card
                      key={task.id}
                      variant="interactive"
                      className={cn("border-l-4", priorityColors[task.priority])}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", statusColors[task.status])}
                              >
                                {task.status.replace("_", " ")}
                              </Badge>
                              {task.priority === "urgent" && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  <Flag className="w-3 h-3 mr-1" />
                                  Urgent
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                {task.project.name}
                              </span>
                              {task.phase && (
                                <span>• {task.phase.name}</span>
                              )}
                              {task.due_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(task.due_date), "MMM d")}
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <MessageSquare className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Paperclip className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {getActionButton(task)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <OnlinePresence organizationId={organization.id} />
          </div>
        </div>
      </div>
    </div>
  );
}