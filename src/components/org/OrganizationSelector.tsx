import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building, Users, Crown, ShieldCheck, UserCheck, UserIcon, Plus, Key, LogOut, Clock, Upload, Mail, Eye, EyeOff, Shield, Phone } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/contexts/PresenceContext";
import { ModeToggle } from "@/components/mode-toggle";

type Organization = Tables<"my_organizations">;
type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OrganizationWithRole extends Organization {
  role: UserRole;
}

interface OrganizationSelectorProps {
  onOrganizationSelect: (org: OrganizationWithRole) => void;
}

const roleIcons = {
  owner: Crown,
  admin: ShieldCheck,
  supervisor: UserCheck,
  employee: UserIcon,
};

const roleColors = {
  owner: "bg-gradient-points",
  admin: "bg-primary",
  supervisor: "bg-accent",
  employee: "bg-secondary",
};

export function OrganizationSelector({ onOrganizationSelect }: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [clockInDialogOpen, setClockInDialogOpen] = useState(false);
  const [selectedOrgForClockIn, setSelectedOrgForClockIn] = useState<OrganizationWithRole | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profile, setProfile] = useState<{ id: string; full_name: string; email: string; avatar_url?: string; phone?: string | null } | null>(null);
  const [profileForm, setProfileForm] = useState<{ full_name: string; phone: string }>({ full_name: "", phone: "" });
  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" });
  const [clockingIn, setClockingIn] = useState(false);
  const { toast } = useToast();
  
  // Try to get presence context, but don't fail if not available
  let presenceContext;
  try {
    presenceContext = usePresence();
  } catch (error) {
    // Presence context not available, that's okay
    presenceContext = null;
  }

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // Load profile when settings dialog opens
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("users")
          .select("id, full_name, email, avatar_url, phone")
          .eq("id", user.id)
          .single();
        if (data) {
          setProfile(data);
          setProfileForm({ full_name: data.full_name || "", phone: data.phone || "" });
        }
      } catch (e) {
        // Ignore
      }
    };
    if (settingsOpen) loadProfile();
  }, [settingsOpen]);

  // Update current time every second when clock in dialog is open
  useEffect(() => {
    if (!clockInDialogOpen) return;
    
    // Update immediately when dialog opens
    setCurrentTime(new Date());
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [clockInDialogOpen]);

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          role,
          organization:organizations(*)
        `)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      const orgsWithRoles = data
        ?.filter(item => item.organization)
        .map(item => ({
          ...item.organization,
          role: item.role,
        })) as OrganizationWithRole[];

      setOrganizations(orgsWithRoles || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = (org: OrganizationWithRole) => {
    // Show clock in confirmation dialog
    setSelectedOrgForClockIn(org);
    setClockInDialogOpen(true);
  };

  const handleConfirmClockIn = async () => {
    if (!selectedOrgForClockIn) return;
    
    setClockingIn(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not found");

      // Clock in
      const { error: clockInError } = await supabase.rpc('create_daily_checkin', {
        p_org_id: selectedOrgForClockIn.id,
        p_user_id: user.id,
        p_source: 'web'
      });

      if (clockInError) throw clockInError;

      // Update last_selected for this organization
      await supabase
        .from("organization_members")
        .update({ last_selected: false })
        .eq("user_id", user.id);

      await supabase
        .from("organization_members")
        .update({ last_selected: true })
        .eq("user_id", user.id)
        .eq("organization_id", selectedOrgForClockIn.id);

      // Set user presence to online
      if (presenceContext?.setUserOnline) {
        await presenceContext.setUserOnline();
      }

      toast({
        title: "Clocked In",
        description: `Successfully clocked in to ${selectedOrgForClockIn.name}`,
      });

      onOrganizationSelect(selectedOrgForClockIn);
      setClockInDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clock in",
        variant: "destructive",
      });
    } finally {
      setClockingIn(false);
      setSelectedOrgForClockIn(null);
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_org_with_owner', {
        p_name: orgName.trim(),
        p_description: orgDescription.trim() || null,
      });

      if (error) throw error;

      // Fetch the created organization to get full details
      const { data: newOrg, error: fetchError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", data)
        .single();

      if (fetchError) throw fetchError;

      // Auto clock-in for newly created organization
      const authUser = (await supabase.auth.getUser()).data.user;
      if (!authUser) throw new Error("User not found");

      const { error: clockInError } = await supabase.rpc('create_daily_checkin', {
        p_org_id: newOrg.id,
        p_user_id: authUser.id,
        p_source: 'web'
      });
      if (clockInError) throw clockInError;

      // Update last_selected flags
      await supabase
        .from("organization_members")
        .update({ last_selected: false })
        .eq("user_id", authUser.id);

      await supabase
        .from("organization_members")
        .update({ last_selected: true })
        .eq("user_id", authUser.id)
        .eq("organization_id", newOrg.id);

      // Set presence online
      if (presenceContext?.setUserOnline) {
        await presenceContext.setUserOnline();
      }

      toast({
        title: "Clocked In",
        description: `Organization created and clocked in to ${newOrg.name}`,
      });

      // Select the new organization
      onOrganizationSelect({
        ...newOrg,
        role: "owner" as UserRole,
      });

      setCreateDialogOpen(false);
      setOrgName("");
      setOrgDescription("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Error",
        description: "Invite code is required",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('claim_org_invite', {
        p_code: inviteCode.trim(),
      });

      if (error) throw error;

      // Fetch the organization details
      const { data: org, error: fetchError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", data[0].organization_id)
        .single();

      if (fetchError) throw fetchError;

      // Auto clock-in for newly joined organization
      const authUser = (await supabase.auth.getUser()).data.user;
      if (!authUser) throw new Error("User not found");

      const { error: clockInError } = await supabase.rpc('create_daily_checkin', {
        p_org_id: org.id,
        p_user_id: authUser.id,
        p_source: 'web'
      });
      if (clockInError) throw clockInError;

      // Update last_selected flags
      await supabase
        .from("organization_members")
        .update({ last_selected: false })
        .eq("user_id", authUser.id);

      await supabase
        .from("organization_members")
        .update({ last_selected: true })
        .eq("user_id", authUser.id)
        .eq("organization_id", org.id);

      // Set presence online
      if (presenceContext?.setUserOnline) {
        await presenceContext.setUserOnline();
      }

      toast({
        title: "Clocked In",
        description: `Successfully joined and clocked in to ${org.name}`,
      });

      // Select the organization
      onOrganizationSelect({
        ...org,
        role: data[0].role,
      });

      setJoinDialogOpen(false);
      setInviteCode("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join organization",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      setLogoutDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  // Settings helpers
  const handleAvatarChange = () => fileInputRef.current?.click();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please select an image", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', profile.id);
      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl });
      toast({ title: 'Avatar updated' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('users').update({ 
        full_name: profileForm.full_name,
        phone: profileForm.phone || null
      }).eq('id', profile.id);
      if (error) throw error;
      toast({ title: 'Profile saved' });
      setProfile({ ...profile, full_name: profileForm.full_name, phone: profileForm.phone || null });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword.length < 6 || passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: "Invalid password", description: "Check length and confirmation", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast({ title: 'Password updated' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message || 'Try again', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <ModeToggle />
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Shield className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[85vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Update your profile and manage security</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-6rem)] pr-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Profile Information</CardTitle>
                    <CardDescription>Update your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback>{profile?.full_name?.substring(0,2).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Button variant="outline" onClick={handleAvatarChange} disabled={uploading} className="flex items-center gap-2">
                          <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Change Avatar'}
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                        <p className="text-xs text-muted-foreground">Max 5MB, JPG/PNG/GIF</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input id="full_name" value={profileForm.full_name} onChange={(e)=>setProfileForm({...profileForm, full_name: e.target.value })} placeholder="Enter your full name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <Input id="email" value={profile?.email} disabled className="flex-1" />
                      </div>
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="phone" 
                          value={profileForm.phone} 
                          onChange={(e)=>setProfileForm({...profileForm, phone: e.target.value})} 
                          placeholder="Enter phone number" 
                          className="flex-1" 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save'}</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Security</CardTitle>
                    <CardDescription>Change your password</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} value={passwordData.newPassword} onChange={(e)=>setPasswordData({...passwordData, newPassword: e.target.value})} placeholder="Enter new password" className="pr-10" />
                        <button type="button" onClick={()=>setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={passwordData.confirmPassword} onChange={(e)=>setPasswordData({...passwordData, confirmPassword: e.target.value})} placeholder="Confirm new password" className="pr-10" />
                        <button type="button" onClick={()=>setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                  <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={()=>setSettingsOpen(false)}>Close</Button>
                    <Button onClick={handlePasswordChange} disabled={!passwordData.newPassword || !passwordData.confirmPassword}>Update Password</Button>
                  </DialogFooter>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleLogoutClick}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        <Card variant="elevated" className="w-full max-w-md text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Welcome to Trevor</CardTitle>
            <CardDescription>
              Get started by creating your own organization or joining an existing one with an invite code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Organization</DialogTitle>
                  <DialogDescription>
                    Create your own organization and become the owner.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-description">Description (Optional)</Label>
                    <Textarea
                      id="org-description"
                      value={orgDescription}
                      onChange={(e) => setOrgDescription(e.target.value)}
                      placeholder="Describe your organization"
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateOrganization} 
                    disabled={creating || !orgName.trim()}
                    className="w-full"
                  >
                    {creating ? "Creating..." : "Create Organization"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Key className="w-4 h-4 mr-2" />
                  Join with Invite Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join Organization</DialogTitle>
                  <DialogDescription>
                    Enter the invite code provided by your organization admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="invite-code">Invite Code</Label>
                    <Input
                      id="invite-code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Enter invite code"
                    />
                  </div>
                  <Button 
                    onClick={handleJoinOrganization} 
                    disabled={joining || !inviteCode.trim()}
                    className="w-full"
                  >
                    {joining ? "Joining..." : "Join Organization"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <AlertDialog open={clockInDialogOpen} onOpenChange={setClockInDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clock In</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Do you want to clock in to <strong>{selectedOrgForClockIn?.name}</strong>? This will start tracking your time for this organization.
                </p>
                <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-mono font-bold text-foreground">
                    {formatTime(currentTime)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  This is the time that will be recorded for your clock in
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedOrgForClockIn(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClockIn} disabled={clockingIn}>
                {clockingIn ? "Clocking In..." : "Clock In"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log Out</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? "Logging out..." : "Log Out"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <ModeToggle />
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Shield className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[85vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Update your profile and manage security</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-6rem)] pr-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Profile Information</CardTitle>
                    <CardDescription>Update your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback>{profile?.full_name?.substring(0,2).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <Button variant="outline" onClick={handleAvatarChange} disabled={uploading} className="flex items-center gap-2">
                          <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Change Avatar'}
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                        <p className="text-xs text-muted-foreground">Max 5MB, JPG/PNG/GIF</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input id="full_name" value={profileForm.full_name} onChange={(e)=>setProfileForm({...profileForm, full_name: e.target.value })} placeholder="Enter your full name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <Input id="email" value={profile?.email} disabled className="flex-1" />
                      </div>
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="phone" 
                          value={profileForm.phone} 
                          onChange={(e)=>setProfileForm({...profileForm, phone: e.target.value})} 
                          placeholder="Enter phone number" 
                          className="flex-1" 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveProfile} disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save'}</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Security</CardTitle>
                    <CardDescription>Change your password</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} value={passwordData.newPassword} onChange={(e)=>setPasswordData({...passwordData, newPassword: e.target.value})} placeholder="Enter new password" className="pr-10" />
                        <button type="button" onClick={()=>setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={passwordData.confirmPassword} onChange={(e)=>setPasswordData({...passwordData, confirmPassword: e.target.value})} placeholder="Confirm new password" className="pr-10" />
                        <button type="button" onClick={()=>setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                  <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={()=>setSettingsOpen(false)}>Close</Button>
                    <Button onClick={handlePasswordChange} disabled={!passwordData.newPassword || !passwordData.confirmPassword}>Update Password</Button>
                  </DialogFooter>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleLogoutClick}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">My Organizations</h1>
          <p className="text-muted-foreground">Click on an organization to clock in and access your dashboard</p>
        </div>

        <div className="grid gap-4 mb-6">
          {organizations.map((org) => {
            const RoleIcon = roleIcons[org.role];
            
            return (
              <Card
                key={org.id}
                variant="interactive"
                className="cursor-pointer"
                onClick={() => handleSelectOrganization(org)}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={org.logo_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {org.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold">{org.name}</h3>
                      <Badge variant="secondary" className={cn("text-xs", roleColors[org.role])}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {org.role}
                      </Badge>
                    </div>
                    {org.description && (
                      <p className="text-sm text-muted-foreground">{org.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Team</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Create your own organization and become the owner.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Enter organization name"
                  />
                </div>
                <div>
                  <Label htmlFor="org-description">Description (Optional)</Label>
                  <Textarea
                    id="org-description"
                    value={orgDescription}
                    onChange={(e) => setOrgDescription(e.target.value)}
                    placeholder="Describe your organization"
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleCreateOrganization} 
                  disabled={creating || !orgName.trim()}
                  className="w-full"
                >
                  {creating ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Key className="w-4 h-4 mr-2" />
                Join with Invite Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Organization</DialogTitle>
                <DialogDescription>
                  Enter the invite code provided by your organization admin.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-code">Invite Code</Label>
                  <Input
                    id="invite-code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter invite code"
                  />
                </div>
                <Button 
                  onClick={handleJoinOrganization} 
                  disabled={joining || !inviteCode.trim()}
                  className="w-full"
                >
                  {joining ? "Joining..." : "Join Organization"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>

        <AlertDialog open={clockInDialogOpen} onOpenChange={setClockInDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clock In</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Do you want to clock in to <strong>{selectedOrgForClockIn?.name}</strong>? This will start tracking your time for this organization.
                </p>
                <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-mono font-bold text-foreground">
                    {formatTime(currentTime)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  This is the time that will be recorded for your clock in
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedOrgForClockIn(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClockIn} disabled={clockingIn}>
                {clockingIn ? "Clocking In..." : "Clock In"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log Out</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? "Logging out..." : "Log Out"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}