import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, UserPlus, Link2, Mail, Trash2, Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Invitation {
  id: string;
  code: string;
  role: UserRole;
  email?: string;
  expires_at: string;
  used_at?: string;
  used_by?: string;
  created_at: string;
  created_by?: string;
}

interface InvitationManagerProps {
  organizationId: string;
  userRole: UserRole;
}

export function InvitationManager({ organizationId, userRole }: InvitationManagerProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState({
    role: "employee" as UserRole,
    email: "",
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Role hierarchy check - who can invite whom
  const canInviteRole = (targetRole: UserRole): boolean => {
    const hierarchy = { owner: 4, admin: 3, supervisor: 2, employee: 1 };
    const userLevel = hierarchy[userRole];
    const targetLevel = hierarchy[targetRole];
    
    return userLevel >= targetLevel;
  };

  const canCreateInvites = userRole !== "employee";

  useEffect(() => {
    if (canCreateInvites) {
      fetchInvitations();
    } else {
      setLoading(false);
    }
  }, [organizationId, canCreateInvites]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('org_invites')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: "Error",
        description: "Failed to load invitations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async () => {
    if (!canCreateInvites) return;
    
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from('org_invites')
        .insert({
          organization_id: organizationId,
          role: newInvite.role,
          email: newInvite.email || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setInvitations(prev => [data, ...prev]);
      setNewInvite({ role: "employee", email: "" });
      setIsDialogOpen(false);
      
      toast({
        title: "Invitation created",
        description: "Invitation code has been generated successfully",
      });
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: "Error",
        description: "Failed to create invitation",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Invitation code copied to clipboard",
    });
  };

  const deleteInvitation = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('org_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
      toast({
        title: "Invitation deleted",
        description: "Invitation has been removed",
      });
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({
        title: "Error", 
        description: "Failed to delete invitation",
        variant: "destructive",
      });
    }
  };

  const getInviteStatus = (invite: Invitation) => {
    if (invite.used_at) return "used";
    if (new Date(invite.expires_at) < new Date()) return "expired";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "used":
        return <Badge variant="secondary">Used</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "active":
        return <Badge className="bg-success text-success-foreground">Active</Badge>;
      default:
        return null;
    }
  };

  const availableRoles = (["employee", "supervisor", "admin", "owner"] as UserRole[])
    .filter(role => canInviteRole(role));

  if (!canCreateInvites) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Team Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="w-full h-10 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Team Invitations
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Create Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Team Invitation</DialogTitle>
                <DialogDescription>
                  Generate an invitation code for new team members
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newInvite.role} 
                    onValueChange={(value: UserRole) => setNewInvite(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map(role => (
                        <SelectItem key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite(prev => ({ ...prev, email: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for a general invitation code
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={createInvitation} disabled={creating} className="flex-1">
                    {creating ? "Creating..." : "Create Invitation"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {invitations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No invitations created yet</p>
            <p className="text-sm">Create your first invitation to invite team members</p>
          </div>
        ) : (
          invitations.map((invite) => {
            const status = getInviteStatus(invite);
            
            return (
              <Card key={invite.id} variant="interactive" className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                      </Badge>
                      {getStatusBadge(status)}
                      {invite.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {invite.email}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created {format(new Date(invite.created_at), "MMM d")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {status === "active" && (
                      <div className="mt-2 p-3 bg-muted rounded border-2 border-dashed border-primary/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Invitation Code:</p>
                            <code className="text-sm font-mono text-primary font-semibold">
                              {invite.code}
                            </code>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteCode(invite.code)}
                            className="shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteInvitation(invite.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}