import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  FolderOpen, 
  Calendar, 
  Target, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  User,
  Circle,
  Plus,
  Coins,
  Users,
  BarChart3,
  Trash2,
  CalendarClock,
  GitBranch
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Project {
  id: string;
  name: string;
  description?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  owner_id: string;
  current_phase?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'overdue' | 'blocked' | 'submitted';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  assignee_id?: string;
  completion_points?: number;
  assignee?: {
    full_name: string;
    email: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'overdue' | 'blocked' | 'submitted';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  completion_points?: number;
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  progressPercentage: number;
  totalAssignments?: number;
  completedAssignments?: number;
}

export function ProjectDetail() {
  const { projectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Array<{user_id: string, users: {full_name: string}}>>([]);
  const [stats, setStats] = useState<ProjectStats>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    progressPercentage: 0,
    totalAssignments: 0,
    completedAssignments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("tasks");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    due_date: "",
    assignee_id: "",
    completion_points: 0,
  });
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [selectedAssignmentForExtension, setSelectedAssignmentForExtension] = useState<Assignment | null>(null);
  const [extensionRequest, setExtensionRequest] = useState({
    requested_due_at: "",
    reason: "",
  });

  useEffect(() => {
    // Initialize tab from query param if provided
    const tab = searchParams.get("tab");
    if (tab && ["tasks", "assignments", "reports"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (projectName && organization) {
      fetchProjectDetails();
      fetchTeamMembers();
    }
  }, [projectName, organization]);

  const fetchTeamMembers = async () => {
    if (!organization) return;
    
    try {
      // Fetch all employees in the organization
      const { data: employeesData, error: employeesError } = await supabase
        .from("organization_members")
        .select("user_id, users!inner(full_name)")
        .eq("organization_id", organization.id)
        .eq("role", "employee");

      if (employeesError) throw employeesError;
      setEmployees(employeesData as any || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    }
  };

  const fetchProjectDetails = async () => {
    try {
      if (!organization) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("name", projectName)
        .eq("organization_id", organization.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          created_at,
          assignee_id,
          completion_points,
          assignee:users!tasks_assignee_id_fkey(full_name, email)
        `)
        .eq("project_id", projectData.id)
        .eq("task_type", "task")
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;
      
      const tasksWithOverdueStatus = (tasksData || []).map(task => {
        if (task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date()) {
          return { ...task, status: 'overdue' as const };
        }
        return task;
      });

      setTasks(tasksWithOverdueStatus);

      // Fetch my assignments (assignments assigned to me)
      const { data: myAssignmentsData } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, created_at, completion_points")
        .eq("project_id", projectData.id)
        .eq("task_type", "assignment")
        .eq("assignee_id", user.id)
        .order("created_at", { ascending: false });

      if (myAssignmentsData) {
        const assignmentsWithOverdue = myAssignmentsData.map(assignment => {
          if (assignment.status !== 'done' && assignment.due_date && new Date(assignment.due_date) < new Date()) {
            return { ...assignment, status: 'overdue' as const };
          }
          return assignment;
        });
        setMyAssignments(assignmentsWithOverdue as any);
      }

      // Calculate statistics
      const totalTasks = tasksWithOverdueStatus.length;
      const completedTasks = tasksWithOverdueStatus.filter(task => task.status === 'done').length;
      const inProgressTasks = tasksWithOverdueStatus.filter(task => task.status === 'in_progress').length;
      const overdueTasks = tasksWithOverdueStatus.filter(task => task.status === 'overdue').length;
      const totalAssignments = myAssignmentsData?.length || 0;
      const completedAssignments = myAssignmentsData?.filter(a => a.status === 'done').length || 0;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setStats({
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        progressPercentage,
        totalAssignments,
        completedAssignments,
      });

    } catch (error) {
      console.error("Error fetching project details:", error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "high": 
        return "destructive";
      case "medium": 
        return "default";
      case "low": 
        return "secondary";
      default: 
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": 
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "in_progress": 
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "todo": 
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
      case "overdue": 
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      default: 
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "todo":
        return <Circle className="w-4 h-4 text-gray-500" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatStatusText = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleCreateTask = async () => {
    if (!project || !newTask.title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    if (!newTask.due_date) {
      toast({
        title: "Error",
        description: "Due date is required",
        variant: "destructive",
      });
      return;
    }

    if (!newTask.assignee_id || newTask.assignee_id === "unassigned") {
      toast({
        title: "Error",
        description: "Please assign the task to an employee",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          due_date: newTask.due_date,
          assignee_id: newTask.assignee_id,
          completion_points: newTask.completion_points || 0,
          project_id: project.id,
          status: "todo",
          task_type: "task",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task created successfully",
      });

      setTaskDialogOpen(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assignee_id: "",
        completion_points: 0,
      });
      fetchProjectDetails();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error, data } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .select();

      if (error) {
        console.error("Error deleting task:", error);
        throw error;
      }

      // Verify the task was actually deleted
      if (!data || data.length === 0) {
        throw new Error("Task deletion failed - no rows were deleted");
      }

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      fetchProjectDetails();
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAssignmentAsDone = async (assignmentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get the assignment details to check for completion points
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("tasks")
        .select("completion_points")
        .eq("id", assignmentId)
        .single();

      if (assignmentError) throw assignmentError;

      // Update assignment status to done
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ 
          status: "done",
          updated_at: new Date().toISOString()
        })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      // Award points if the assignment has completion points
      if (assignmentData.completion_points && assignmentData.completion_points > 0) {
        const { error: pointsError } = await supabase
          .from("points_ledger")
          .insert({
            user_id: user.id,
            delta: assignmentData.completion_points,
            reason_code: "task_completion",
            task_id: assignmentId,
          });

        if (pointsError) throw pointsError;

        toast({
          title: "Assignment Completed! 🎉",
          description: `You earned ${assignmentData.completion_points} points!`,
        });
      } else {
        toast({
          title: "Assignment Completed!",
          description: "Great job completing this assignment!",
        });
      }

      // Refresh project details
      await fetchProjectDetails();
    } catch (error) {
      console.error("Error marking assignment as done:", error);
      toast({
        title: "Error",
        description: "Failed to mark assignment as done",
        variant: "destructive",
      });
    }
  };

  const handleRequestExtension = async () => {
    if (!selectedAssignmentForExtension || !extensionRequest.requested_due_at) {
      toast({
        title: "Error",
        description: "Please select a new due date",
        variant: "destructive",
      });
      return;
    }

    if (!extensionRequest.reason || extensionRequest.reason.trim() === "") {
      toast({
        title: "Error",
        description: "Please provide a reason for the extension request",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("extension_requests")
        .insert({
          task_id: selectedAssignmentForExtension.id,
          requester_id: user.id,
          requested_due_at: extensionRequest.requested_due_at,
          reason: extensionRequest.reason,
          status: "pending",
        });

      if (error) {
        console.error("Error requesting extension:", error);
        throw error;
      }

      toast({
        title: "Extension Request Sent",
        description: "Your extension request has been sent to admins and owners for approval",
      });

      setExtensionDialogOpen(false);
      setSelectedAssignmentForExtension(null);
      setExtensionRequest({ requested_due_at: "", reason: "" });
    } catch (error: any) {
      console.error("Error requesting extension:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to request extension. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openExtensionDialog = (assignment: Assignment) => {
    setSelectedAssignmentForExtension(assignment);
    setExtensionRequest({
      requested_due_at: assignment.due_date || "",
      reason: "",
    });
    setExtensionDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/supervisor/projects")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Progress Tracking
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/supervisor/projects")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <FolderOpen className="w-6 h-6" />
                  {project.name}
                </h1>
                <p className="text-sm text-muted-foreground">Project Details</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Project Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Information */}
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
                <CardDescription>
                  {project.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{new Date(project.updated_at).toLocaleDateString()}</p>
                  </div>
                  {project.due_date && (
                    <div>
                      <p className="text-muted-foreground">Expected Completion</p>
                      <p className="font-medium">{new Date(project.due_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Phase */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Current Phase
                </CardTitle>
              </CardHeader>
              <CardContent>
                {project.current_phase ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <GitBranch className="w-5 h-5 text-primary" />
                      <span className="text-base font-semibold text-primary">{project.current_phase}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No phase set</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall Progress</span>
                      <span>{stats.progressPercentage}%</span>
                    </div>
                    <Progress value={stats.progressPercentage} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">My Assignments</span>
                      <span className="font-medium">{stats.totalAssignments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team Tasks</span>
                      <span className="font-medium">{stats.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-green-600">{stats.completedTasks}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Team Tasks ({stats.totalTasks})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              My Assignments ({stats.totalAssignments})
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Employee Tasks</h2>
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>
                      Create a task and assign it to an employee with reward points
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-title">
                        Task Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="task-title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="Enter task title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea
                        id="task-description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder="Enter task description"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-priority">Priority</Label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-due-date">
                          Due Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="task-due-date"
                          type="date"
                          value={newTask.due_date}
                          onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-assignee">
                        Assign to Employee <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={newTask.assignee_id || "unassigned"}
                        onValueChange={(value) => setNewTask({ ...newTask, assignee_id: value === "unassigned" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Select an employee...</SelectItem>
                          {employees.map((emp) => (
                            <SelectItem key={emp.user_id} value={emp.user_id}>
                              {emp.users.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-points">Completion Points</Label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="task-points"
                          type="number"
                          min="0"
                          max="100"
                          value={newTask.completion_points === 0 ? "" : newTask.completion_points}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setNewTask({ ...newTask, completion_points: 0 });
                            } else {
                              const numValue = parseInt(value) || 0;
                              const clampedValue = Math.min(Math.max(numValue, 0), 100);
                              setNewTask({ ...newTask, completion_points: clampedValue });
                            }
                          }}
                          onFocus={(e) => {
                            if (e.target.value === "0" || e.target.value === "") {
                              e.target.select();
                            }
                          }}
                          placeholder="Points to award"
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Points awarded to the employee when task is completed (max 100)</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTask}>Create Task</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground font-medium mb-2">No tasks yet</p>
                      <p className="text-sm text-muted-foreground">Create your first task for employees</p>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <Card key={task.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-1">{getStatusIcon(task.status)}</div>
                              <div className="flex-1">
                                <h3 className="font-medium text-sm mb-1">{task.title}</h3>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {task.assignee && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>{task.assignee.full_name}</span>
                                    </div>
                                  )}
                                  {task.completion_points && task.completion_points > 0 && (
                                    <div className="flex items-center gap-1 text-amber-600">
                                      <Coins className="w-3 h-3" />
                                      <span>{task.completion_points} points</span>
                                    </div>
                                  )}
                                  {task.due_date && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      <span className={task.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                                        Due: {new Date(task.due_date).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                              </Badge>
                              <Badge className={`${getStatusColor(task.status)} text-xs`}>
                                {formatStatusText(task.status)}
                              </Badge>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{task.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Assignments</h2>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {myAssignments.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground font-medium mb-2">No assignments</p>
                      <p className="text-sm text-muted-foreground">You don't have any assignments in this project</p>
                    </div>
                  ) : (
                    myAssignments.map((assignment) => (
                      <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-1">{getStatusIcon(assignment.status)}</div>
                              <div className="flex-1">
                                <h3 className="font-medium text-sm mb-1">{assignment.title}</h3>
                                {assignment.description && (
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {assignment.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {assignment.completion_points && assignment.completion_points > 0 && (
                                    <div className="flex items-center gap-1 text-amber-600">
                                      <Coins className="w-3 h-3" />
                                      <span>{assignment.completion_points} points</span>
                                    </div>
                                  )}
                                  {assignment.due_date && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      <span className={assignment.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge variant={getPriorityColor(assignment.priority)} className="text-xs">
                                {assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)}
                              </Badge>
                              <Badge className={`${getStatusColor(assignment.status)} text-xs`}>
                                {formatStatusText(assignment.status)}
                              </Badge>
                              {assignment.status !== 'done' && (
                                <div className="flex flex-col gap-2 ml-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkAssignmentAsDone(assignment.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Done
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openExtensionDialog(assignment)}
                                  >
                                    <CalendarClock className="w-3 h-3 mr-1" />
                                    Request Extension
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Progress Report</CardTitle>
                <CardDescription>Overview of team performance and my assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Target className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                        <p className="text-2xl font-bold">{stats.totalTasks}</p>
                        <p className="text-sm text-muted-foreground">Total Tasks</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2" />
                        <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
                        <p className="text-sm text-muted-foreground">Completed</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Clock className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                        <p className="text-2xl font-bold text-blue-600">{stats.inProgressTasks}</p>
                        <p className="text-sm text-muted-foreground">In Progress</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                        <p className="text-2xl font-bold text-red-600">{stats.overdueTasks}</p>
                        <p className="text-sm text-muted-foreground">Overdue</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator className="my-6" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      My Assignments
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Assignments:</span>
                        <span className="font-medium">{stats.totalAssignments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Completed:</span>
                        <span className="font-medium text-green-600">{stats.completedAssignments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pending:</span>
                        <span className="font-medium text-orange-600">
                          {(stats.totalAssignments || 0) - (stats.completedAssignments || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Team Progress
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Completion Rate</span>
                          <span className="font-medium">{stats.progressPercentage}%</span>
                        </div>
                        <Progress value={stats.progressPercentage} className="h-3" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {stats.completedTasks} out of {stats.totalTasks} tasks completed
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Extension Request Dialog */}
      <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Deadline Extension</DialogTitle>
            <DialogDescription>
              Request a new deadline for: <strong>{selectedAssignmentForExtension?.title}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-due-date">Current Due Date</Label>
              <Input
                id="current-due-date"
                type="date"
                value={selectedAssignmentForExtension?.due_date || ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requested-due-date">
                Requested New Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="requested-due-date"
                type="date"
                value={extensionRequest.requested_due_at}
                onChange={(e) => setExtensionRequest({ ...extensionRequest, requested_due_at: e.target.value })}
                min={selectedAssignmentForExtension?.due_date || new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="extension-reason"
                value={extensionRequest.reason}
                onChange={(e) => setExtensionRequest({ ...extensionRequest, reason: e.target.value })}
                placeholder="Explain why you need more time..."
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">Please provide a clear reason for your extension request</p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setExtensionDialogOpen(false);
                setSelectedAssignmentForExtension(null);
                setExtensionRequest({ requested_due_at: "", reason: "" });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRequestExtension}>
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

