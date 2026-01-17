import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

interface Booking {
  id: string;
  booking_date: string;
  status: string;
  payment_status: string;
  services: {
    name: string;
    price: number;
  } | null;
}

interface DashboardAnalyticsProps {
  bookings: Booking[];
}

export const DashboardAnalytics = ({ bookings }: DashboardAnalyticsProps) => {
  const analytics = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const weeklyBookings = bookings.filter((b) => {
      const date = parseISO(b.booking_date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    const monthlyBookings = bookings.filter((b) => {
      const date = parseISO(b.booking_date);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });

    const calculateRevenue = (bookingsList: Booking[], status?: string) => {
      return bookingsList
        .filter((b) => !status || b.status === status)
        .reduce((sum, b) => sum + (b.services?.price || 0), 0);
    };

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter((b) => b.status === 'completed').length;
    const upcomingBookings = bookings.filter((b) => b.status === 'upcoming').length;
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;

    const weeklyRevenue = calculateRevenue(weeklyBookings, 'completed');
    const monthlyRevenue = calculateRevenue(monthlyBookings, 'completed');
    const totalRevenue = calculateRevenue(bookings, 'completed');
    const pendingRevenue = calculateRevenue(bookings.filter((b) => b.status === 'upcoming'));

    const completionRate = totalBookings > 0 
      ? Math.round((completedBookings / totalBookings) * 100) 
      : 0;

    const serviceCounts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.services?.name) {
        serviceCounts[b.services.name] = (serviceCounts[b.services.name] || 0) + 1;
      }
    });
    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      totalBookings,
      completedBookings,
      upcomingBookings,
      cancelledBookings,
      weeklyRevenue,
      monthlyRevenue,
      totalRevenue,
      pendingRevenue,
      completionRate,
      weeklyBookings: weeklyBookings.length,
      monthlyBookings: monthlyBookings.length,
      topServices,
    };
  }, [bookings]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-300">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-400">₹{analytics.weeklyRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{analytics.weeklyBookings} bookings</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-300">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">₹{analytics.monthlyRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{analytics.monthlyBookings} bookings</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-300">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-400">₹{analytics.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{analytics.completedBookings} completed</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-yellow-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-300">Pending Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">₹{analytics.pendingRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{analytics.upcomingBookings} upcoming</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Booking Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-medium text-foreground">{analytics.completionRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                style={{ width: `${analytics.completionRate}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-400">{analytics.upcomingBookings}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-400">{analytics.completedBookings}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">{analytics.cancelledBookings}</p>
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </div>
          </div>

          {analytics.topServices.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Top Services</p>
              <div className="space-y-2">
                {analytics.topServices.map(([service, count], index) => (
                  <div key={service} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm text-foreground">{service}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{count} bookings</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
