import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Building2, CheckCircle2, GitBranch } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function CreateProject() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    due_date: "",
    current_phase: "",
  });
  const defaultPhases = [
    "Planning Phase",
    "Analysis Phase",
    "Design Phase",
    "Development Phase",
    "Testing Phase",
    "Deployment Phase",
    "Maintenance Phase"
  ];

  // Check for duplicate project names in the same organization
  useEffect(() => {
    const checkDuplicateName = async () => {
      // Reset error if name is empty
      if (!formData.name.trim()) {
        setNameError("");
        return;
      }

      // Don't check if organization is not available
      if (!organization) {
        return;
      }

      setCheckingName(true);
      try {
        const trimmedName = formData.name.trim();
        const { data, error } = await supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", organization.id);

        if (error) {
          console.error("Error checking duplicate name:", error);
          return;
        }

        // Check for case-insensitive duplicate
        const isDuplicate = data?.some(
          (project) => project.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (isDuplicate) {
          setNameError("This project name has been used, try another one");
        } else {
          setNameError("");
        }
      } catch (error) {
        console.error("Error checking duplicate name:", error);
      } finally {
        setCheckingName(false);
      }
    };

    // Debounce the check to avoid too many API calls
    const timeoutId = setTimeout(() => {
      checkDuplicateName();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.name, organization]);

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

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    if (nameError) {
      toast({
        title: "Error",
        description: nameError,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: formData.name,
          description: formData.description,
          due_date: formData.due_date || null,
          current_phase: formData.current_phase || null,
          organization_id: organization.id,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project created successfully",
      });

      // Navigate to the project detail page
      navigate(`/owner/projects/${data.name}`);
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
                <Building2 className="w-6 h-6" />
                Create New Project
              </h1>
              <p className="text-sm text-muted-foreground">Add a new project to your organization</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Fill in the information below to create a new project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Organization Info */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">Organization</p>
                <p className="text-lg font-semibold">{organization?.name || "No organization selected"}</p>
              </div>

              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter project name"
                  required
                  disabled={loading}
                  className={nameError ? "border-destructive" : ""}
                />
                {nameError ? (
                  <p className="text-xs text-destructive">
                    {nameError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose a clear, descriptive name for your project
                  </p>
                )}
              </div>

              {/* Project Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter project description"
                  rows={5}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Provide details about the project goals, scope, and objectives
                </p>
              </div>

              {/* Project Phase */}
              <div className="space-y-2">
                <Label htmlFor="current_phase">Project Phase</Label>
                <Select
                  value={formData.current_phase}
                  onValueChange={(value) => setFormData({ ...formData, current_phase: value })}
                  disabled={loading}
                >
                  <SelectTrigger id="current_phase">
                    <SelectValue placeholder="Select a project phase (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultPhases.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the initial phase of the project (optional)
                </p>
              </div>

              {/* Project Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">Expected Completion Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Set the expected date for project completion (optional)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/owner/projects")}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !organization || !!nameError || checkingName}>
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Create Project
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
              <Building2 className="w-4 h-4" />
              What happens next?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>Your project will be created and visible to all organization members</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>You can create tasks for employees and assignments for supervisors</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <span>Track progress and generate reports from the project detail page</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

