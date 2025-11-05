import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Search,
  Filter,
  Circle,
  Plus,
  Coins,
  Users,
  BarChart3,
  Trash2,
  Pencil,
  CalendarClock,
  GitBranch
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  task_type?: 'task' | 'assignment';
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
  assignee_id?: string;
  completion_points?: number;
  assignee?: {
    full_name: string;
    email: string;
  };
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Array<{user_id: string, users: {full_name: string}}>>([]);
  const [supervisors, setSupervisors] = useState<Array<{user_id: string, users: {full_name: string}}>>([]);
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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("tasks");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    due_date: "",
    assignee_id: "",
    completion_points: 0,
  });
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    due_date: "",
    assigned_supervisor_id: "",
    completion_points: 0,
  });
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editProjectData, setEditProjectData] = useState({
    name: "",
    description: "",
    due_date: "",
  });
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const defaultPhases = [
    "Planning Phase",
    "Analysis Phase",
    "Design Phase",
    "Development Phase",
    "Testing Phase",
    "Deployment Phase",
    "Maintenance Phase"
  ];

  // Create a list of available phases that includes the current project phase if it's not in default phases
  const availablePhases = useMemo(() => {
    const phases = [...defaultPhases];
    if (project?.current_phase && !phases.includes(project.current_phase)) {
      phases.push(project.current_phase);
    }
    return phases;
  }, [project?.current_phase]);

  const filteredTasks = useMemo(() => {
    // Filter to only show tasks (not assignments) in the tasks tab
    let list = tasks.filter(t => !t.task_type || t.task_type === 'task');
    
    if (filterStatus !== "all") {
      list = list.filter(t => t.status === filterStatus);
    }
    
    if (filterPriority !== "all") {
      list = list.filter(t => t.priority === filterPriority);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description ? t.description.toLowerCase().includes(q) : false) ||
        (t.assignee?.full_name ? t.assignee.full_name.toLowerCase().includes(q) : false)
      );
    }
    
    return list;
  }, [tasks, filterStatus, filterPriority, searchQuery]);

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
      // Fetch employees
      const { data: employeesData } = await supabase
        .from("organization_members")
        .select("user_id, users!inner(full_name)")
        .eq("organization_id", organization.id)
        .eq("role", "employee");
      
      if (employeesData) setEmployees(employeesData as any);

      // Fetch supervisors
      const { data: supervisorsData } = await supabase
        .from("organization_members")
        .select("user_id, users!inner(full_name)")
        .eq("organization_id", organization.id)
        .eq("role", "supervisor");
      
      if (supervisorsData) setSupervisors(supervisorsData as any);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      if (!organization) return;
      
      // Fetch project details by name first
      let projectData;
      let projectError;
      
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("name", projectName)
        .eq("organization_id", organization.id)
        .single();
      
      projectData = data;
      projectError = error;

      // If fetching by name fails and we have a project with ID, try fetching by ID as fallback
      if (projectError && project?.id) {
        const { data: dataById, error: errorById } = await supabase
          .from("projects")
          .select("*")
          .eq("id", project.id)
          .single();
        
        if (!errorById && dataById) {
          projectData = dataById;
          projectError = null;
        }
      }

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch project tasks with assignee information (only tasks, not assignments)
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
          task_type,
          completion_points,
          assignee:users!tasks_assignee_id_fkey(
            full_name,
            email
          )
        `)
        .eq("project_id", projectData.id)
        .eq("task_type", "task")
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;
      
      // Calculate overdue tasks based on due_date and current status
      const tasksWithOverdueStatus = (tasksData || []).map(task => {
        // If task is not done and due_date is in the past, mark as overdue
        if (task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date()) {
          return {
            ...task,
            status: 'overdue' as const,
            task_type: (task.task_type || 'task') as 'task' | 'assignment'
          };
        }
        return {
          ...task,
          task_type: (task.task_type || 'task') as 'task' | 'assignment'
        };
      });

      setTasks(tasksWithOverdueStatus as Task[]);

      // Fetch assignments (stored in tasks table with task_type = 'assignment')
      const { data: assignmentsData, error: assignmentsError } = await supabase
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
        .eq("task_type", "assignment")
        .order("created_at", { ascending: false });

      if (!assignmentsError && assignmentsData) {
        const assignmentsWithOverdue = assignmentsData.map(assignment => {
          if (assignment.status !== 'done' && assignment.due_date && new Date(assignment.due_date) < new Date()) {
            return { ...assignment, status: 'overdue' as const };
          }
          return assignment;
        });
        setAssignments(assignmentsWithOverdue as any);
      }

      // Calculate project statistics with proper overdue count
      const totalTasks = tasksWithOverdueStatus.length;
      const completedTasks = tasksWithOverdueStatus.filter(task => task.status === 'done').length;
      const inProgressTasks = tasksWithOverdueStatus.filter(task => task.status === 'in_progress').length;
      const overdueTasks = tasksWithOverdueStatus.filter(task => task.status === 'overdue').length;
      const totalAssignments = assignmentsData?.length || 0;
      const completedAssignments = assignmentsData?.filter(a => a.status === 'done').length || 0;
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
        return "destructive";
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
      case "review":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300";
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
      case "review":
        return <AlertCircle className="w-4 h-4 text-purple-500" />;
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

  const handleCreateAssignment = async () => {
    if (!project || !newAssignment.title.trim()) {
      toast({
        title: "Error",
        description: "Assignment title is required",
        variant: "destructive",
      });
      return;
    }

    if (!newAssignment.due_date) {
      toast({
        title: "Error",
        description: "Due date is required",
        variant: "destructive",
      });
      return;
    }

    if (!newAssignment.assigned_supervisor_id || newAssignment.assigned_supervisor_id === "unassigned") {
      toast({
        title: "Error",
        description: "Please assign the assignment to a supervisor",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: newAssignment.title,
          description: newAssignment.description,
          priority: newAssignment.priority,
          due_date: newAssignment.due_date,
          assignee_id: newAssignment.assigned_supervisor_id,
          completion_points: newAssignment.completion_points || 0,
          project_id: project.id,
          status: "todo",
          task_type: "assignment",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment created successfully",
      });

      setAssignmentDialogOpen(false);
      setNewAssignment({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assigned_supervisor_id: "",
        completion_points: 0,
      });
      fetchProjectDetails();
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: "Failed to create assignment",
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

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const { error, data } = await supabase
        .from("tasks")
        .delete()
        .eq("id", assignmentId)
        .select();

      if (error) {
        console.error("Error deleting assignment:", error);
        throw error;
      }

      // Verify the assignment was actually deleted
      if (!data || data.length === 0) {
        throw new Error("Assignment deletion failed - no rows were deleted");
      }

      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });

      fetchProjectDetails();
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    try {
      // Delete all tasks associated with the project first
      const { error: tasksError } = await supabase
        .from("tasks")
        .delete()
        .eq("project_id", project.id);

      if (tasksError) throw tasksError;

      // Delete the project
      const { error: projectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (projectError) throw projectError;

      toast({
        title: "Success",
        description: "Project deleted successfully",
      });

      // Navigate back to projects list
      navigate("/owner/projects");
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProject = async () => {
    if (!project || !editProjectData.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: editProjectData.name,
          description: editProjectData.description,
          due_date: editProjectData.due_date || null,
        })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project updated successfully",
      });

      setEditProjectDialogOpen(false);
      
      // If project name changed, navigate to the new URL to trigger refetch
      if (editProjectData.name !== project.name) {
        const currentTab = searchParams.get("tab");
        const newPath = `/owner/projects/${encodeURIComponent(editProjectData.name)}${currentTab ? `?tab=${currentTab}` : ''}`;
        navigate(newPath);
      } else {
        // If name didn't change, just refetch the details
        fetchProjectDetails();
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePhase = async (phase: string) => {
    if (!project) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ current_phase: phase })
        .eq("id", project.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project phase updated successfully",
      });

      fetchProjectDetails();
    } catch (error) {
      console.error("Error updating phase:", error);
      toast({
        title: "Error",
        description: "Failed to update phase",
        variant: "destructive",
      });
    }
  };

  const handleCreatePhase = async () => {
    if (!newPhaseName.trim()) {
      toast({
        title: "Error",
        description: "Phase name is required",
        variant: "destructive",
      });
      return;
    }

    setPhaseDialogOpen(false);
    setNewPhaseName("");
    handleUpdatePhase(newPhaseName.trim());
  };

  const handleOpenEditDialog = () => {
    if (project) {
      setEditProjectData({
        name: project.name,
        description: project.description || "",
        due_date: project.due_date || "",
      });
      setEditProjectDialogOpen(true);
    }
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
          <Button onClick={() => navigate("/owner/projects")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
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
              <Button variant="ghost" size="icon" onClick={() => navigate("/owner/projects")}>
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
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/owner/extension-requests")}
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Extension Requests
              </Button>
              <Dialog open={editProjectDialogOpen} onOpenChange={setEditProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Update Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Update Project</DialogTitle>
                    <DialogDescription>
                      Update the project details below
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-project-name">
                        Project Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="edit-project-name"
                        value={editProjectData.name}
                        onChange={(e) => setEditProjectData({ ...editProjectData, name: e.target.value })}
                        placeholder="Enter project name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-project-description">Description</Label>
                      <Textarea
                        id="edit-project-description"
                        value={editProjectData.description}
                        onChange={(e) => setEditProjectData({ ...editProjectData, description: e.target.value })}
                        placeholder="Enter project description"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-project-due-date">Expected Completion Date</Label>
                      <Input
                        id="edit-project-due-date"
                        type="date"
                        value={editProjectData.due_date}
                        onChange={(e) => setEditProjectData({ ...editProjectData, due_date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditProjectDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateProject}>
                      Update Project
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the project
                      <strong className="text-foreground"> "{project.name}"</strong> and all associated tasks and assignments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Project Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
          {/* Project Info */}
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

            {/* Project Phase Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Project Phase
                </CardTitle>
                <CardDescription>
                  Track the current phase of the project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-phase">Current Phase</Label>
                    <Select
                      value={project.current_phase || ""}
                      onValueChange={handleUpdatePhase}
                    >
                      <SelectTrigger id="current-phase">
                        <SelectValue placeholder="Select or add a phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePhases.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            {phase}
                          </SelectItem>
                        ))}
                        {(organization?.role === "owner" || organization?.role === "admin") && (
                          <>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/50">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start h-8"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPhaseDialogOpen(true);
                                }}
                              >
                                <Plus className="w-3 h-3 mr-2" />
                                Add Custom Phase
                              </Button>
                            </div>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {project.current_phase && (
                      <p className="text-xs text-muted-foreground">
                        Project is currently in: <span className="font-medium text-primary">{project.current_phase}</span>
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Progress Overview */}
          <div>
            <Card className="h-full">
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
                      <span className="text-muted-foreground">Total Tasks</span>
                      <span className="font-medium">{stats.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Assignments</span>
                      <span className="font-medium">{stats.totalAssignments || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-green-600">{stats.completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In Progress</span>
                      <span className="font-medium text-blue-600">{stats.inProgressTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overdue</span>
                      <span className="font-medium text-red-600">{stats.overdueTasks}</span>
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
              Tasks ({stats.totalTasks})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Assignments ({stats.totalAssignments})
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
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Supervisor Assignments</h2>
              <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Assignment</DialogTitle>
                    <DialogDescription>
                      Create an assignment and assign it to a supervisor with reward points
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="assignment-title">
                        Assignment Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="assignment-title"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        placeholder="Enter assignment title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assignment-description">Description</Label>
                      <Textarea
                        id="assignment-description"
                        value={newAssignment.description}
                        onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                        placeholder="Enter assignment description"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assignment-priority">Priority</Label>
                        <Select
                          value={newAssignment.priority}
                          onValueChange={(value: any) => setNewAssignment({ ...newAssignment, priority: value })}
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
                        <Label htmlFor="assignment-due-date">
                          Due Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="assignment-due-date"
                          type="date"
                          value={newAssignment.due_date}
                          onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assignment-supervisor">
                        Assign to Supervisor <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={newAssignment.assigned_supervisor_id || "unassigned"}
                        onValueChange={(value) => setNewAssignment({ ...newAssignment, assigned_supervisor_id: value === "unassigned" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Select a supervisor...</SelectItem>
                          {supervisors.map((sup) => (
                            <SelectItem key={sup.user_id} value={sup.user_id}>
                              {sup.users.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assignment-points">Completion Points</Label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="assignment-points"
                          type="number"
                          min="0"
                          max="100"
                          value={newAssignment.completion_points === 0 ? "" : newAssignment.completion_points}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setNewAssignment({ ...newAssignment, completion_points: 0 });
                            } else {
                              const numValue = parseInt(value) || 0;
                              const clampedValue = Math.min(Math.max(numValue, 0), 100);
                              setNewAssignment({ ...newAssignment, completion_points: clampedValue });
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
                      <p className="text-xs text-muted-foreground">Points awarded to the supervisor when assignment is completed (max 100)</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateAssignment}>Create Assignment</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {assignments.length === 0 ? (
                <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground font-medium mb-2">No assignments yet</p>
                      <p className="text-sm text-muted-foreground">Create your first assignment for supervisors</p>
                    </div>
                  ) : (
                    assignments.map((assignment) => (
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
                                  {assignment.assignee && (
                                    <div className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      <span>{assignment.assignee.full_name}</span>
                                    </div>
                                  )}
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
                                    <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{assignment.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteAssignment(assignment.id)}
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

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Progress Report</CardTitle>
                <CardDescription>Overview of project completion and team performance</CardDescription>
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
                      Assignments for Supervisors
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Assignments:</span>
                        <span className="font-medium">{stats.totalAssignments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Completed Assignments:</span>
                        <span className="font-medium text-green-600">{stats.completedAssignments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pending Assignments:</span>
                        <span className="font-medium text-orange-600">
                          {(stats.totalAssignments || 0) - (stats.completedAssignments || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Overall Progress
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

      {/* Dialog for creating custom phase */}
      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Phase</DialogTitle>
            <DialogDescription>
              Create a custom phase for this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="phase-name">Phase Name</Label>
            <Input
              id="phase-name"
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              placeholder="e.g., Research Phase"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePhase}>
              Add Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}