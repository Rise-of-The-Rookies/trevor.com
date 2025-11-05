import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarClock, 
  CheckCircle2, 
  XCircle, 
  Clock,
  User,
  Calendar,
  FileText,
  AlertCircle,
  ArrowLeft,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format } from "date-fns";

interface ExtensionRequest {
  id: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  reason: string | null;
  requested_due_at: string;
  status: 'pending' | 'approved' | 'rejected';
  task_id: string | null;
  requester?: {
    full_name: string;
    email: string;
  };
  task?: {
    title: string;
    description: string;
    due_date: string;
    task_type: string;
    priority: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
  project?: {
    name: string;
  };
}

export default function ExtensionRequests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [extensionRequest, setExtensionRequest] = useState({
    requested_due_at: "",
    reason: "",
  });
  const [searchParams] = useSearchParams();

  // Initialize tab from query param only once on mount or when URL changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["pending", "approved", "rejected"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Fetch data when organization or activeTab changes
  useEffect(() => {
    const fetchData = async () => {
      if (organization) {
        await Promise.all([fetchExtensionRequests(), fetchAssignments()]);
      }
    };
    fetchData();
  }, [organization, activeTab]);

  const fetchExtensionRequests = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch extension requests for the current user
      const { data: extensionData, error } = await supabase
        .from("extension_requests")
        .select(`
          *,
          requester:users!extension_requests_requester_id_fkey(full_name, email),
          task:tasks!extension_requests_task_id_fkey(title, description, due_date, task_type, priority)
        `)
        .eq("requester_id", user.id)
        .eq("status", activeTab as 'pending' | 'approved' | 'rejected')
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests(extensionData as any || []);
    } catch (error) {
      console.error("Error fetching extension requests:", error);
      toast({
        title: "Error",
        description: "Failed to load extension requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organization) return;

      // Get all projects in the organization
      const { data: orgProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", organization.id);

      if (!orgProjects || orgProjects.length === 0) {
        setAssignments([]);
        return;
      }

      const projectIds = orgProjects.map(p => p.id);

      // Get all assignments assigned to this supervisor
      const { data: assignmentsData, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          due_date,
          priority,
          status,
          project:projects!tasks_project_id_fkey(name)
        `)
        .eq("task_type", "assignment")
        .eq("assignee_id", user.id)
        .in("project_id", projectIds)
        .neq("status", "done")
        .order("due_date", { ascending: true });

      if (error) throw error;

      setAssignments(assignmentsData as any || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  const handleRequestExtension = async () => {
    if (!selectedAssignment || !extensionRequest.requested_due_at) {
      toast({
        title: "Error",
        description: "Please select an assignment and a new due date",
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
          task_id: selectedAssignment.id,
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

      setRequestDialogOpen(false);
      setSelectedAssignment(null);
      setExtensionRequest({ requested_due_at: "", reason: "" });
      fetchExtensionRequests();
    } catch (error: any) {
      console.error("Error requesting extension:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to request extension. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openRequestDialog = (assignment: Assignment | null) => {
    if (assignment) {
      setSelectedAssignment(assignment);
      setExtensionRequest({
        requested_due_at: assignment.due_date || "",
        reason: "",
      });
    } else {
      setSelectedAssignment(null);
      setExtensionRequest({
        requested_due_at: "",
        reason: "",
      });
    }
    setRequestDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  if (loading && requests.length === 0) {
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CalendarClock className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Extension Requests</h1>
                <p className="text-sm text-muted-foreground">Request extensions and view your request history</p>
              </div>
            </div>
            <Button onClick={() => openRequestDialog(null)} className="gap-2">
              <Plus className="w-4 h-4" />
              Request Extension
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium mb-2">
                      No {activeTab} extension requests
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === 'pending' 
                        ? "You don't have any pending extension requests"
                        : `You don't have any ${activeTab} extension requests`
                      }
                    </p>
                    {activeTab === 'pending' && (
                      <Button 
                        onClick={() => openRequestDialog(null)} 
                        className="mt-4"
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Request Extension
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{request.task?.title}</h3>
                            {getPriorityBadge(request.task?.priority || '')}
                          </div>
                          {request.task?.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {request.task.description}
                            </p>
                          )}
                        </div>
                        <div>
                          {getStatusBadge(request.status)}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Requested on:</span>
                            <span>{request.created_at ? format(new Date(request.created_at), "MMM dd, yyyy") : 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Current due:</span>
                            <span>{request.task?.due_date ? format(new Date(request.task.due_date), "MMM dd, yyyy") : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarClock className="w-4 h-4 text-primary" />
                            <span className="font-medium">Requested due:</span>
                            <span className="text-primary font-medium">
                              {request.requested_due_at ? format(new Date(request.requested_due_at), "MMM dd, yyyy") : 'N/A'}
                            </span>
                          </div>
                          {request.decided_at && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">Decided on:</span>
                              <span>{format(new Date(request.decided_at), "MMM dd, yyyy")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reason */}
                      {request.reason && (
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="font-medium block mb-1">Your Reason:</span>
                              <p className="text-muted-foreground">{request.reason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Decision Note (for approved/rejected) */}
                      {request.decision_note && request.status !== 'pending' && (
                        <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="font-medium block mb-1">Decision Note:</span>
                              <p className="text-muted-foreground">{request.decision_note}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Extension Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Extension</DialogTitle>
            <DialogDescription>
              Request an extension for an assignment deadline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-select">
                Assignment <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedAssignment?.id || ""}
                onValueChange={(value) => {
                  const assignment = assignments.find(a => a.id === value);
                  setSelectedAssignment(assignment || null);
                  setExtensionRequest({
                    requested_due_at: assignment?.due_date || "",
                    reason: extensionRequest.reason,
                  });
                }}
              >
                <SelectTrigger id="assignment-select">
                  <SelectValue placeholder="Select an assignment" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      All assignments are done, Great Job! 🎉
                    </div>
                  ) : (
                    assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{assignment.title}</span>
                          <span className="text-xs text-muted-foreground">
                            Due: {assignment.due_date ? format(new Date(assignment.due_date), "MMM dd, yyyy") : 'N/A'}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension-date">
                New Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="extension-date"
                type="date"
                value={extensionRequest.requested_due_at}
                onChange={(e) => setExtensionRequest({ ...extensionRequest, requested_due_at: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
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
                setRequestDialogOpen(false);
                setSelectedAssignment(null);
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

