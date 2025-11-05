import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in_at?: string;
  clock_out_at?: string;
  local_date: string;
  users: {
    full_name?: string;
    email: string;
  };
  role?: string;
  status?: "early" | "on-time" | "late" | "absent";
  hasOvertime?: boolean;
  isAbsent?: boolean;
}

interface WorkHoursConfig {
  work_start_time: string;
  work_end_time: string;
  early_threshold_minutes: number;
  late_threshold_minutes: number;
}

interface DateGroup {
  date: string;
  records: AttendanceRecord[];
  stats: {
    total: number;
    early: number;
    onTime: number;
    late: number;
    overtime: number;
    absent: number;
  };
}

const ITEMS_PER_PAGE = 20;

export function AttendanceHistory() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState(searchParams.get("filter") || "all");
  const [workHours, setWorkHours] = useState<WorkHoursConfig>({
    work_start_time: "09:00:00",
    work_end_time: "17:00:00",
    early_threshold_minutes: 15,
    late_threshold_minutes: 15,
  });

  useEffect(() => {
    if (organization) {
      fetchWorkHours();
      fetchAttendanceHistory();
    }
  }, [organization]);

  useEffect(() => {
    applyFilter();
  }, [attendanceRecords, activeFilter]);

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1);
  }, [activeFilter]);

  const fetchWorkHours = async () => {
    try {
      if (!organization) return;

      const { data, error } = await supabase
        .from("organizations")
        .select("work_start_time, work_end_time, early_threshold_minutes, late_threshold_minutes")
        .eq("id", organization.id)
        .single();

      if (error || !data || !('work_start_time' in data)) {
        return;
      }

      setWorkHours({
        work_start_time: (data as any).work_start_time || "09:00:00",
        work_end_time: (data as any).work_end_time || "17:00:00",
        early_threshold_minutes: (data as any).early_threshold_minutes || 15,
        late_threshold_minutes: (data as any).late_threshold_minutes || 15,
      });
    } catch (error) {
      console.error("Error fetching work hours:", error);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      if (!organization) return;
      setLoading(true);

      // Fetch organization details to get creation date
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("created_at")
        .eq("id", organization.id)
        .single();

      if (orgError) throw orgError;

      // Use the organization's creation date or 30 days ago, whichever is more recent
      const orgCreatedDate = orgData?.created_at ? new Date(orgData.created_at) : null;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Start from the organization creation date, or 30 days ago if org was created more than 30 days ago
      const startDate = orgCreatedDate && orgCreatedDate > thirtyDaysAgo 
        ? orgCreatedDate 
        : thirtyDaysAgo;
      
      const startDateString = startDate.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      // Fetch all organization members
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", organization.id);

      if (membersError) throw membersError;

      // Fetch all user details
      const allMemberIds = membersData?.map((m) => m.user_id) || [];
      const { data: allUsersData } = await supabase
        .from("users")
        .select("id, email, full_name")
        .in("id", allMemberIds);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance_checkins")
        .select("*")
        .eq("org_id", organization.id)
        .gte("local_date", startDateString)
        .order("local_date", { ascending: false })
        .order("clock_in_at", { ascending: false });

      if (attendanceError) throw attendanceError;

      const allRecords: AttendanceRecord[] = [];

      // Generate date range from start date to today
      const dateRange: string[] = [];
      const currentDate = new Date();
      const loopDate = new Date(startDate);
      
      while (loopDate <= currentDate) {
        dateRange.push(loopDate.toISOString().split('T')[0]);
        loopDate.setDate(loopDate.getDate() + 1);
      }
      
      // Reverse to show most recent dates first
      dateRange.reverse();

      // Process each date
      for (const date of dateRange) {
        const dateAttendance = attendanceData?.filter((a) => a.local_date === date) || [];
        const attendedUserIds = dateAttendance.map((a) => a.user_id);

        // Add records; if clock-in occurs after work end time, treat as absent
        dateAttendance.forEach((record) => {
          const user = allUsersData?.find((u) => u.id === record.user_id);
          const role = membersData?.find((m) => m.user_id === record.user_id)?.role;

          // Determine if clock-in is after work end time for that date
          let isAfterWorkEnd = false;
          if (record.clock_in_at) {
            const clockIn = new Date(record.clock_in_at);
            const workEnd = new Date(clockIn);
            const [endHours, endMinutes] = workHours.work_end_time.split(":").map(Number);
            workEnd.setHours(endHours, endMinutes, 0, 0);
            isAfterWorkEnd = clockIn.getTime() > workEnd.getTime();
          }

          if (isAfterWorkEnd) {
            // Count as absent for the day
            allRecords.push({
              id: `absent-after-end-${record.local_date}-${record.user_id}`,
              user_id: record.user_id,
              local_date: record.local_date,
              users: user || { email: "Unknown", full_name: null },
              role: role || "employee",
              status: "absent",
              isAbsent: true,
            } as AttendanceRecord);
          } else {
            const status = getArrivalStatus(record.clock_in_at);
            const hasOvertime = record.clock_out_at && checkHasOvertime(record.clock_in_at, record.clock_out_at);
            allRecords.push({
              ...record,
              users: user || { email: "Unknown", full_name: null },
              role: role || "employee",
              status,
              hasOvertime,
              isAbsent: false,
            });
          }
        });

        // Check if it's past work end time for this date to determine absent status
        const dateObj = new Date(date);
        const now = new Date();
        const isPastDate = dateObj.toISOString().split('T')[0] < today;
        
        // For today, check if current time is past work end time
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [endHours, endMinutes] = workHours.work_end_time.split(':').map(Number);
        const workEndMinutes = endHours * 60 + endMinutes;
        const isPastWorkEnd = currentTime > workEndMinutes;

        // Mark absent only if it's a past date OR if today and past work end time
        if (isPastDate || (date === today && isPastWorkEnd)) {
          // Add absent records for members who didn't clock in
          membersData?.forEach((member) => {
            if (!attendedUserIds.includes(member.user_id)) {
              const user = allUsersData?.find((u) => u.id === member.user_id);
              allRecords.push({
                id: `absent-${date}-${member.user_id}`,
                user_id: member.user_id,
                local_date: date,
                users: user || { email: "Unknown", full_name: null },
                role: member.role || "employee",
                status: "absent",
                isAbsent: true,
              });
            }
          });
        }
      }

      setAttendanceRecords(allRecords);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch attendance history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getArrivalStatus = (clockInTime?: string): "early" | "on-time" | "late" | "absent" => {
    if (!clockInTime) return "absent";
    
    const clockIn = new Date(clockInTime);
    const workStart = new Date(clockIn);
    
    const [hours, minutes] = workHours.work_start_time.split(':').map(Number);
    workStart.setHours(hours, minutes, 0, 0);

    const diffMinutes = (clockIn.getTime() - workStart.getTime()) / (1000 * 60);

    if (diffMinutes <= -workHours.early_threshold_minutes) return "early";
    if (diffMinutes <= workHours.late_threshold_minutes) return "on-time";
    return "late";
  };

  const checkHasOvertime = (clockInTime: string, clockOutTime: string): boolean => {
    const clockOut = new Date(clockOutTime);
    const workEnd = new Date(clockOut);
    
    const [hours, minutes] = workHours.work_end_time.split(':').map(Number);
    workEnd.setHours(hours, minutes, 0, 0);

    return clockOut.getTime() > workEnd.getTime();
  };

  const calculateWorkHours = (clockInTime: string, clockOutTime?: string): string => {
    if (!clockOutTime) return "Still working";
    
    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    
    const hours = Math.floor(hoursWorked);
    const minutes = Math.round((hoursWorked - hours) * 60);
    
    return `${hours}h ${minutes}m`;
  };

  const applyFilter = () => {
    // Generate all date groups for last 30 days
    const dateRange: string[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dateRange.push(date.toISOString().split('T')[0]);
    }

    // Filter records based on active filter
    let filtered = [...attendanceRecords];
    switch (activeFilter) {
      case "attended":
        filtered = filtered.filter((r) => r.status === "early" || r.status === "on-time" || r.status === "late");
        break;
      case "on-time":
        filtered = filtered.filter((r) => r.status === "on-time");
        break;
      case "early":
        filtered = filtered.filter((r) => r.status === "early");
        break;
      case "late":
        filtered = filtered.filter((r) => r.status === "late");
        break;
      case "absent":
        filtered = filtered.filter((r) => r.status === "absent");
        break;
      case "overtime":
        filtered = filtered.filter((r) => r.hasOvertime);
        break;
      // "all" shows all records
    }

    // Create date groups for all dates
    const grouped: DateGroup[] = dateRange.map((date) => {
      // Get all records for this date (from full attendance records)
      const allDateRecords = attendanceRecords.filter((r) => r.local_date === date);
      
      // Get filtered records for this date
      const dateFilteredRecords = filtered.filter((r) => r.local_date === date);

      return {
        date,
        records: dateFilteredRecords,
        stats: {
          total: allDateRecords.length,
          early: allDateRecords.filter((r) => r.status === "early").length,
          onTime: allDateRecords.filter((r) => r.status === "on-time").length,
          late: allDateRecords.filter((r) => r.status === "late").length,
          overtime: allDateRecords.filter((r) => r.hasOvertime).length,
          absent: allDateRecords.filter((r) => r.status === "absent").length,
        },
      };
    });

    setDateGroups(grouped);
    setFilteredRecords(filtered);
  };

  const getStatusBadge = (status: "early" | "on-time" | "late" | "absent") => {
    switch (status) {
      case "early":
        return <Badge className="bg-blue-500"><CheckCircle2 className="w-3 h-3 mr-1" />Early</Badge>;
      case "on-time":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />On Time</Badge>;
      case "late":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Late</Badge>;
      case "absent":
        return <Badge className="bg-gray-500"><XCircle className="w-3 h-3 mr-1" />Absent</Badge>;
    }
  };

  const getNoRecordsMessage = (filter: string) => {
    switch (filter) {
      case "attended":
        return "No one attended";
      case "on-time":
        return "No one was on time";
      case "early":
        return "No one was early";
      case "late":
        return "No one was late";
      case "absent":
        return "No one was absent";
      case "overtime":
        return "No one worked overtime";
      default:
        return "No records";
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Attendance History</h1>
                <p className="text-sm text-muted-foreground">
                  Last 30 days{filteredRecords.length > 0 ? ` • ${filteredRecords.length} ${activeFilter !== 'all' ? activeFilter : ''} records` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Filter Tabs */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All", icon: Calendar },
                { value: "attended", label: "Attended", icon: CheckCircle2 },
                { value: "on-time", label: "On Time", icon: CheckCircle2 },
                { value: "early", label: "Early", icon: TrendingUp },
                { value: "late", label: "Late", icon: AlertCircle },
                { value: "absent", label: "Absent", icon: XCircle },
                { value: "overtime", label: "Overtime", icon: Clock },
              ].map((filter) => {
                const Icon = filter.icon;
                return (
                  <Button
                    key={filter.value}
                    variant={activeFilter === filter.value ? "default" : "outline"}
                    onClick={() => setActiveFilter(filter.value)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {filter.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records - always show 30-day sections, even if none match filter */}
        <>
          {/* Group by dates */}
          {dateGroups.map((dateGroup) => {
                return (
                  <Card key={dateGroup.date}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            {format(new Date(dateGroup.date), "EEEE, MMMM d, yyyy")}
                          </CardTitle>
                          <CardDescription>
                            {dateGroup.stats.total} total attendance records
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {dateGroup.stats.early} Early
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {dateGroup.stats.onTime} On Time
                          </Badge>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {dateGroup.stats.late} Late
                          </Badge>
                          <Badge variant="outline" className="bg-gray-50 text-gray-700">
                            {dateGroup.stats.absent} Absent
                          </Badge>
                          {dateGroup.stats.overtime > 0 && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              {dateGroup.stats.overtime} OT
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {dateGroup.records.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground italic">
                            {getNoRecordsMessage(activeFilter)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dateGroup.records.map((record) => {
                          const hoursWorked = record.isAbsent ? "Absent" : calculateWorkHours(record.clock_in_at, record.clock_out_at);

                          return (
                            <div
                              key={record.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <Avatar className="w-10 h-10">
                                  <AvatarFallback className="text-sm font-semibold">
                                    {record.users.email.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {record.users.full_name || record.users.email}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {record.users.email}
                                  </p>
                                </div>
                                <Badge variant="outline" className="capitalize">
                                  {record.role}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-6">
                                {record.isAbsent ? (
                                  <>
                                    <div className="text-center w-64">
                                      <p className="text-sm text-muted-foreground">No clock-in record</p>
                                    </div>
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      {getStatusBadge(record.status!)}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="text-center w-20">
                                      <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                                      <p className="text-sm font-mono font-semibold">
                                        {record.clock_in_at ? format(new Date(record.clock_in_at), "HH:mm:ss") : "—"}
                                      </p>
                                    </div>

                                    <div className="text-center w-20">
                                      <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                                      <p className="text-sm font-mono font-semibold">
                                        {record.clock_out_at 
                                          ? format(new Date(record.clock_out_at), "HH:mm:ss")
                                          : "—"}
                                      </p>
                                    </div>

                                    <div className="text-center w-20">
                                      <p className="text-xs text-muted-foreground mb-1">Hours</p>
                                      <p className="text-sm font-semibold">{hoursWorked}</p>
                                    </div>

                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      {getStatusBadge(record.status!)}
                                      {record.hasOvertime && (
                                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                                          <Clock className="w-3 h-3 mr-1" />
                                          OT
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          {/* Pagination - Hidden since we show all dates */}
          {false && totalPages > 1 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} records
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      </div>
    </div>
  );
}

