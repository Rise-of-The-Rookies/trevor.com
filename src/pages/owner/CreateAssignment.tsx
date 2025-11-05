import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, CheckCircle2, Coins, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Project {
  id: string;
  name: string;
}

interface Supervisor {
  user_id: string;
  users: {
    full_name: string;
    email: string;
  };
}

export default function CreateAssignment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    project_id: "",
    assignee_id: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    due_date: "",
    completion_points: 0,
  });

  useEffect(() => {
    if (organization) {
      fetchData();
    }
  }, [organization]);

  const fetchData = async () => {
    if (!organization) return;

    setLoadingData(true);
    try {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Fetch supervisors
      const { data: supervisorsData, error: supervisorsError } = await supabase
        .from("organization_members")
        .select("user_id, users!inner(full_name, email)")
        .eq("organization_id", organization.id)
        .eq("role", "supervisor");

      if (supervisorsError) throw supervisorsError;
      setSupervisors(supervisorsData as any || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load projects and supervisors",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization) {
      toast({
        title: "Error",
        description: "Please select an organization first",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Assignment title is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.project_id) {
      toast({
        title: "Error",
        description: "Please select a project",
        variant: "destructive",
      });
      return;
    }

    if (!formData.due_date) {
      toast({
        title: "Error",
        description: "Due date is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.assignee_id || formData.assignee_id === "unassigned") {
      toast({
        title: "Error",
        description: "Please assign the assignment to a supervisor",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description || null,
          project_id: formData.project_id,
          assignee_id: formData.assignee_id || null,
          priority: formData.priority,
          due_date: formData.due_date || null,
          completion_points: formData.completion_points || 0,
          status: "todo",
          task_type: "assignment",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment created successfully",
      });

      // Navigate back to the specific project detail page
      const project = projects.find((p) => p.id === formData.project_id);
      if (project?.name) {
        // Check current path to determine if user is admin or owner
        const currentPath = window.location.pathname;
        if (currentPath.includes('/admin/')) {
          navigate(`/admin/progress-tracking/${project.name}`);
        } else {
          navigate(`/owner/projects/${project.name}`);
        }
      } else {
        // Navigate to appropriate projects list based on current path
        const currentPath = window.location.pathname;
        if (currentPath.includes('/admin/')) {
          navigate(`/admin/progress-tracking`);
        } else {
          navigate(`/owner/projects`);
        }
      }
    } catch (error: any) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Users className="w-6 h-6" />
                Create New Assignment
              </h1>
              <p className="text-sm text-muted-foreground">Assign work to a supervisor</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
            <CardDescription>
              Create an assignment and assign it to a supervisor with reward points
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Organization Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">Organization</p>
                <p className="text-lg font-semibold">{organization?.name || "No organization selected"}</p>
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label htmlFor="project">
                  Project <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                  disabled={loading || projects.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={projects.length === 0 ? "No projects available" : "Select a project"} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {projects.length === 0 && (
                  <p className="text-xs text-destructive">
                    You need to create a project first before creating assignments
                  </p>
                )}
              </div>

              {/* Assignment Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Assignment Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter assignment title"
                  required
                  disabled={loading}
                />
              </div>

              {/* Assignment Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter assignment description"
                  rows={4}
                  disabled={loading}
                />
              </div>

              {/* Priority and Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                    disabled={loading}
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
                  <Label htmlFor="due_date">
                    Due Date <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      required
                      disabled={loading}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Assignee */}
              <div className="space-y-2">
                <Label htmlFor="assignee">
                  Assign to Supervisor <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.assignee_id || "unassigned"}
                  onValueChange={(value) => setFormData({ ...formData, assignee_id: value === "unassigned" ? "" : value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={supervisors.length === 0 ? "No supervisors available" : "Select a supervisor"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Select a supervisor...</SelectItem>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.user_id} value={sup.user_id}>
                        {sup.users.full_name} ({sup.users.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The assignment must be assigned to a supervisor
                </p>
              </div>

              {/* Completion Points */}
              <div className="space-y-2">
                <Label htmlFor="points">Completion Points</Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                  <Input
                    id="points"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.completion_points === 0 ? "" : formData.completion_points}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setFormData({ ...formData, completion_points: 0 });
                      } else {
                        const numValue = parseInt(value) || 0;
                        const clampedValue = Math.min(Math.max(numValue, 0), 100);
                        setFormData({ ...formData, completion_points: clampedValue });
                      }
                    }}
                    onFocus={(e) => {
                      if (e.target.value === "0" || e.target.value === "") {
                        e.target.select();
                      }
                    }}
                    placeholder="0"
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Points awarded to the supervisor when assignment is completed (max 100)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !organization || projects.length === 0}>
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Create Assignment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              About Assignments
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>Assignments are assigned to <strong>supervisors</strong> to complete</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>Supervisors can then create tasks for employees to help complete the assignment</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>Supervisors earn points when they complete assignments</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>Points can be redeemed in the shop for rewards</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

