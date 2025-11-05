import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Building2, Upload, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Organization {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  work_start_time?: string;
  work_end_time?: string;
  early_threshold_minutes?: number;
  late_threshold_minutes?: number;
}

export function OrganizationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization: contextOrganization, setOrganization: setContextOrganization } = useOrganization();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    work_start_time: "09:00",
    work_end_time: "17:00",
    early_threshold_minutes: 15,
    late_threshold_minutes: 15,
  });

  useEffect(() => {
    if (contextOrganization) {
      fetchOrganization();
    }
  }, [contextOrganization]);

  const fetchOrganization = async () => {
    if (!contextOrganization) return;
    
    try {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", contextOrganization.id)
        .single();

      if (data) {
        const orgData = data as any;
        setOrganization(orgData as Organization);
        setFormData({
          name: orgData.name || "",
          description: orgData.description || "",
          work_start_time: orgData.work_start_time ? orgData.work_start_time.substring(0, 5) : "09:00",
          work_end_time: orgData.work_end_time ? orgData.work_end_time.substring(0, 5) : "17:00",
          early_threshold_minutes: orgData.early_threshold_minutes || 15,
          late_threshold_minutes: orgData.late_threshold_minutes || 15,
        });
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!organization || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${organization.id}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('org-logos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      setOrganization({ ...organization, logo_url: publicUrl });
      
      toast({
        title: "Logo uploaded",
        description: "Organization logo updated successfully",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;
    if (!formData.name.trim()) {
      toast({ title: "Name required", description: "Please enter an organization name.", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      // First, try to save with work hours
      const { error: fullUpdateError, data: fullUpdateData } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          description: formData.description,
          work_start_time: `${formData.work_start_time}:00`,
          work_end_time: `${formData.work_end_time}:00`,
          early_threshold_minutes: formData.early_threshold_minutes,
          late_threshold_minutes: formData.late_threshold_minutes,
        })
        .eq("id", organization.id)
        .select();

      // If work hours columns don't exist, fall back to basic update
      if (fullUpdateError && fullUpdateError.code === 'PGRST204') {
        const { error: basicUpdateError, data: basicUpdateData } = await supabase
          .from("organizations")
          .update({
            name: formData.name,
            description: formData.description,
          })
          .eq("id", organization.id)
          .select();

        if (basicUpdateError) throw basicUpdateError;

        // Verify the update actually happened
        if (!basicUpdateData || basicUpdateData.length === 0) {
          throw new Error("Update failed - no rows were updated");
        }

        // Update local state
        const updatedOrg = basicUpdateData[0];
        setOrganization(updatedOrg as Organization);
        setContextOrganization({ ...contextOrganization, ...updatedOrg });

        toast({
          title: "Partial Save",
          description: "Basic settings saved. Work hours require database migration. Please apply the migration to enable work hours configuration.",
          variant: "default",
        });
        return;
      }

      if (fullUpdateError) {
        console.error("Error updating organization:", fullUpdateError);
        throw fullUpdateError;
      }

      // Verify the update actually happened
      if (!fullUpdateData || fullUpdateData.length === 0) {
        throw new Error("Update failed - no rows were updated");
      }

      // Update local state
      const updatedOrg = fullUpdateData[0];
      setOrganization(updatedOrg as Organization);
      setContextOrganization({ ...contextOrganization, ...updatedOrg });

      toast({
        title: "Settings saved",
        description: "Organization settings updated successfully",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization) return;
    if (confirmName.trim() !== (organization?.name || "").trim()) {
      toast({
        title: "Confirmation required",
        description: `Please type "${organization?.name}" to confirm deletion`,
        variant: "destructive",
      });
      return;
    }
    
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Clear all last_selected flags for this user to prevent auto-selection
      await supabase
        .from("organization_members")
        .update({ last_selected: false })
        .eq("user_id", user.id);

      // Delete the organization (cascade deletes should handle related records)
      const { error, data } = await supabase
        .from("organizations")
        .delete()
        .eq("id", organization.id)
        .select();

      if (error) {
        console.error("Error deleting organization:", error);
        throw error;
      }

      // Verify the organization was actually deleted
      if (!data || data.length === 0) {
        throw new Error("Organization deletion failed - no rows were deleted");
      }

      toast({
        title: "Organization deleted",
        description: "Your organization has been permanently deleted",
      });

      // Clear the organization from context
      setContextOrganization(null);
      
      // Redirect to home page (will automatically show OrganizationSelector)
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting organization:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete organization. Please try again.",
        variant: "destructive",
      });
      setDeleting(false);
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Organization Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your organization details</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Update your organization information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter organization name"
              />
              <p className="text-xs text-muted-foreground">This name will be shown across your workspace.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Briefly describe your organization (optional)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Optional. Helps team members understand your workspace.</p>
            </div>

            <div className="space-y-2">
              <Label>Organization Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg flex items-center justify-center border border-dashed">
                  {organization?.logo_url ? (
                    <img src={organization.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <Button variant="secondary" asChild disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">PNG or JPG, square images recommended.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Working Hours Configuration
            </CardTitle>
            <CardDescription>
              Set standard work hours and attendance thresholds for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="work_start_time">Work Start Time</Label>
                <Input
                  id="work_start_time"
                  type="time"
                  value={formData.work_start_time}
                  onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Standard clock-in time for employees
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_end_time">Work End Time</Label>
                <Input
                  id="work_end_time"
                  type="time"
                  value={formData.work_end_time}
                  onChange={(e) => setFormData({ ...formData, work_end_time: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Standard clock-out time for employees
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="early_threshold">Early Arrival Threshold (minutes)</Label>
                <Input
                  id="early_threshold"
                  type="number"
                  min="0"
                  max="60"
                  value={formData.early_threshold_minutes === 0 ? "" : formData.early_threshold_minutes}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setFormData({ ...formData, early_threshold_minutes: 0 });
                    } else {
                      const numValue = parseInt(value) || 0;
                      const clampedValue = Math.min(Math.max(numValue, 0), 60);
                      setFormData({ ...formData, early_threshold_minutes: clampedValue });
                    }
                  }}
                  onFocus={(e) => {
                    if (e.target.value === "0" || e.target.value === "") {
                      e.target.select();
                    }
                  }}
                  placeholder="Enter minutes"
                />
                <p className="text-xs text-muted-foreground">
                  Clock-in this many minutes before start time = early
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="late_threshold">Late Arrival Threshold (minutes)</Label>
                <Input
                  id="late_threshold"
                  type="number"
                  min="0"
                  max="60"
                  value={formData.late_threshold_minutes === 0 ? "" : formData.late_threshold_minutes}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setFormData({ ...formData, late_threshold_minutes: 0 });
                    } else {
                      const numValue = parseInt(value) || 0;
                      const clampedValue = Math.min(Math.max(numValue, 0), 60);
                      setFormData({ ...formData, late_threshold_minutes: clampedValue });
                    }
                  }}
                  onFocus={(e) => {
                    if (e.target.value === "0" || e.target.value === "") {
                      e.target.select();
                    }
                  }}
                  placeholder="Enter minutes"
                />
                <p className="text-xs text-muted-foreground">
                  Clock-in this many minutes after start time = late
                </p>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">How it works:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Early:</strong> Clock-in before {formData.work_start_time} minus {formData.early_threshold_minutes} minutes</li>
                <li><strong>On Time:</strong> Clock-in within {formData.early_threshold_minutes} minutes before to {formData.late_threshold_minutes} minutes after {formData.work_start_time}</li>
                <li><strong>Late:</strong> Clock-in more than {formData.late_threshold_minutes} minutes after {formData.work_start_time}</li>
                <li><strong>Overtime:</strong> Clock-out after {formData.work_end_time}</li>
              </ul>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete this organization and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once you delete an organization, there is no going back. This action will:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Delete all projects and tasks</li>
                <li>Remove all team members</li>
                <li>Delete all organization data permanently</li>
                <li>Cancel all pending invitations</li>
              </ul>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? "Deleting..." : "Delete Organization"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the organization
                      <strong className="block mt-2 text-foreground">"{organization?.name}"</strong>
                      and remove all associated data including projects, tasks, and team members.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="confirm-org-name">Type the organization name to confirm</Label>
                    <Input
                      id="confirm-org-name"
                      placeholder={organization?.name}
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteOrganization}
                      disabled={deleting || confirmName.trim() !== (organization?.name || "").trim()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? "Deleting..." : "Yes, delete organization"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
