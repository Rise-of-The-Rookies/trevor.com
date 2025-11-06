import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";
import { OnlinePresence } from "../shared/OnlinePresence";
import { ClockOutButton } from "../shared/ClockOutButton";
import { NotificationBell } from "../shared/NotificationBell";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Eye, 
  Users, 
  Target, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  Calendar,
  AlertTriangle,
  Gift,
  Coins,
  LogOut,
  FolderOpen,
  Plus,
  CalendarClock,
  Play,
  Pause,
  MessageSquare,
  Paperclip,
  Award
} from "lucide-react";
import { format } from "date-fns";
import { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface SupervisorDashboardProps {
  organization: Organization;
  onLogout: () => void;
  onClockOut: () => void;
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

interface SupervisorStats {
  isClockedIn: boolean;
  totalProjects: number;
  extensionRequests: number;
  totalTeams: number;
  ongoingAssignments: number;
  teamEfficiency: number;
  totalPoints: number;
}

export function SupervisorDashboard({ organization, onLogout, onClockOut }: SupervisorDashboardProps) {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [assignments, setAssignments] = useState<Task[]>([]);
  const [stats, setStats] = useState<SupervisorStats>({
    isClockedIn: false,
    totalProjects: 0,
    extensionRequests: 0,
    totalTeams: 0,
    ongoingAssignments: 0,
    teamEfficiency: 0,
    totalPoints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUserId();
    fetchSupervisorStats();
    fetchAssignments();
  }, [organization.id]);

  const fetchAssignments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects!inner(name, organization_id),
          phase:phases(name)
        `)
        .eq("assignee_id", user.id)
        .eq("project.organization_id", organization.id)
        .eq("task_type", "assignment")
        .neq("status", "done")
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
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

      // If completing an assignment, award points
      if (action === "complete") {
        // Get the assignment details to check for completion points
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

        // Award points if the assignment has completion points
        if (taskData.completion_points && taskData.completion_points > 0) {
          const { error: pointsError } = await supabase
            .from("points_ledger")
            .insert({
              user_id: user.id,
              delta: taskData.completion_points,
              reason_code: "assignment_completion",
              task_id: taskId,
            });

          if (pointsError) throw pointsError;

          // Show success notification with points earned
          toast({
            title: "Assignment Completed! 🎉",
            description: `You earned ${taskData.completion_points} points!`,
          });
        } else {
          // Show completion message without points
          toast({
            title: "Assignment Completed!",
            description: "Great job completing this assignment!",
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

      await fetchAssignments();
      await fetchSupervisorStats();
    } catch (error) {
      console.error("Error updating task:", error);
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

  const fetchSupervisorStats = async () => {
    try {
      // Get current user (supervisor)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch supervisor-specific statistics
      const [pointsData, projectsData, extensionRequestsData, currentClockInData, teamsData, tasksData, completedTasksData, ongoingAssignmentsData] = await Promise.all([
        // Fetch actual points from points_ledger
        supabase
          .from('points_ledger')
          .select('delta')
          .eq('user_id', user.id),
        supabase
          .from('projects')
          .select('id')
          .eq('organization_id', organization.id),
        // Fetch extension requests for the current user
        supabase
          .from('extension_requests')
          .select('id')
          .eq('requester_id', user.id),
        // Check if user is currently clocked in
        supabase
          .from('attendance_checkins')
          .select('id, clock_out_at, local_date')
          .eq('user_id', user.id)
          .eq('local_date', new Date().toISOString().split('T')[0])
          .is('clock_out_at', null)
          .maybeSingle(),
        // Fetch teams where this supervisor is the supervisor_id
        (supabase as any)
          .from('teams')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('supervisor_id', user.id),
        supabase
          .from('tasks')
          .select('status, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id),
        supabase
          .from('tasks')
          .select('status, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
          .eq('status', 'done'),
        // Fetch ongoing assignments for the supervisor
        supabase
          .from('tasks')
          .select('id, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
          .eq('task_type', 'assignment')
          .eq('assignee_id', user.id)
          .neq('status', 'done')
      ]);

      const totalProjects = projectsData.data?.length || 0;
      const extensionRequests = extensionRequestsData.data?.length || 0;
      const isClockedIn = !!currentClockInData.data;
      const totalTeams = teamsData.data?.length || 0;
      const ongoingAssignments = ongoingAssignmentsData.data?.length || 0;

      // Calculate total points from points_ledger (same as employee dashboard)
      const totalPoints = (pointsData.data || []).reduce((sum, transaction) => {
        return sum + transaction.delta;
      }, 0);

      // Calculate efficiency
      const completedTasks = completedTasksData.data || [];
      const totalTasks = tasksData.data?.length || 0;
      const teamEfficiency = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

      setStats({
        isClockedIn,
        totalProjects,
        extensionRequests,
        totalTeams,
        ongoingAssignments,
        teamEfficiency,
        totalPoints,
      });
    } catch (error) {
      console.error('Error fetching supervisor stats:', error);
    } finally {
      setLoading(false);
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
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <p className="text-sm text-muted-foreground">Supervisor Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {userId && <NotificationBell userId={userId} />}
              <Link to="/supervisor/shop">
                <Card variant="points" padding="sm" className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
                  <Coins className="w-5 h-5" />
                  <span className="font-semibold">{stats.totalPoints}</span>
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
        {/* Supervisor Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link to="/supervisor/time-management" className="group">
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

          <Link to="/supervisor/projects" className="group">
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

          <Link to="/supervisor/extension-requests" className="group">
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

          <Link to="/supervisor/teams" className="group">
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
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supervision Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Supervision Tools
                </CardTitle>
                <CardDescription>
                  Manage and oversee your team's work
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/tasks/new">
                      <Plus className="w-6 h-6" />
                      <span>Create Task</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/extension-requests">
                      <CalendarClock className="w-6 h-6" />
                      <span>Extension Requests</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/teams">
                      <Users className="w-6 h-6" />
                      <span>Teams</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/time-management">
                      <Clock className="w-6 h-6" />
                      <span>Logging History</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/shop">
                      <Gift className="w-6 h-6" />
                      <span>Rewards Shop</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/my-rewards">
                      <Award className="w-6 h-6" />
                      <span>My Rewards</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* My Ongoing Assignments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  My Ongoing Assignments
                </CardTitle>
                <CardDescription>
                  {assignments.length} active assignment{assignments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active assignments</p>
                    <p className="text-sm">Great job staying on top of everything!</p>
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <Card
                      key={assignment.id}
                      variant="interactive"
                      className={cn("border-l-4", priorityColors[assignment.priority])}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{assignment.title}</h4>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", statusColors[assignment.status])}
                              >
                                {assignment.status.replace("_", " ")}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                {assignment.project.name}
                              </span>
                              {assignment.phase && (
                                <span>• {assignment.phase.name}</span>
                              )}
                              {assignment.due_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(assignment.due_date), "MMM d")}
                                </span>
                              )}
                            </div>

                            {assignment.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {assignment.description}
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
                            {getActionButton(assignment)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Team Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Team Alerts & Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border-l-4 border-l-warning">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Task overdue: "Database Optimization"</p>
                      <p className="text-xs text-muted-foreground">Assigned to John Doe • Due 2 days ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border-l-4 border-l-primary">
                    <Clock className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Employee requested deadline extension</p>
                      <p className="text-xs text-muted-foreground">Alice Smith • "API Documentation" task</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border-l-4 border-l-success">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Team exceeded this week's goals</p>
                      <p className="text-xs text-muted-foreground">15 tasks completed vs 12 target</p>
                    </div>
                  </div>
                </div>
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