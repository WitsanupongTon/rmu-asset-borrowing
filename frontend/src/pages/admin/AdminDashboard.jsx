import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios'; 
import Swal from 'sweetalert2';
import socket from '../../socket'; // 📌 Import socket เข้ามาใช้งาน
import formatNumber from '../../utils/formatNumber';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line
} from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [isLoading, setIsLoading] = useState(true);

  const [borrows, setBorrows] = useState([]);
  const [items, setItems] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const currentDate = new Date();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState('month');
  // reportYear is the ending Gregorian year; fiscal year 2569 maps to 2026.
  const [reportYear, setReportYear] = useState(currentDate.getFullYear());
  const [reportMonth, setReportMonth] = useState(currentDate.getMonth() + 1);
  const [reportFilter, setReportFilter] = useState(null);

  const BAR_COLORS = ['#f87171', '#60a5fa', '#facc15', '#4ade80', '#c084fc'];

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      navigate('/'); 
      return;
    }
    fetchAllData();

    // ⚡ เชื่อมต่อ Socket หากยังไม่ได้เชื่อมต่อ
    if (!socket.connected) {
      socket.connect();
    }

    // ⚡ ฟังก์ชันดักฟังข้อมูล Real-time ทุกเหตุการณ์แล้วสั่งอัปเดต Dashboard
    const handleUpdate = () => {
      fetchAllData();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'ข้อมูลภาพรวมระบบอัปเดตแล้ว!',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    };

    // ⚡ ผูก Event Listeners ครอบคลุมทุกการเปลี่ยนแปลงในระบบ
    socket.on('borrow_updated', handleUpdate);
    socket.on('borrowsUpdated', handleUpdate);
    socket.on('itemsUpdated', handleUpdate);
    socket.on('inventory_updated', handleUpdate);
    socket.on('users_updated', handleUpdate);

    // ⚡ คืนค่าเพื่อลบ Specific Listener เมื่อ Component Unmount (ไม่ใช้ socket.disconnect())
    return () => {
      socket.off('borrow_updated', handleUpdate);
      socket.off('borrowsUpdated', handleUpdate);
      socket.off('itemsUpdated', handleUpdate);
      socket.off('inventory_updated', handleUpdate);
      socket.off('users_updated', handleUpdate);
    };
  }, [user, navigate]);

  const fetchAllData = async () => {
    try {
      const [borrowsRes, itemsRes, usersRes] = await Promise.all([
        API.get('/borrows/admin/all').catch(() => ({ data: [] })),
        API.get('/items').catch(() => ({ data: [] })),
        API.get('/users/all').catch(() => ({ data: [] }))
      ]);
      
      setBorrows(borrowsRes.data);
      setItems(itemsRes.data);
      const usersData = Array.isArray(usersRes.data)
        ? usersRes.data
        : (usersRes.data.users || usersRes.data.data || []);
      setAllUsers(usersData);

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const now = new Date();
  const getBorrowDate = (record) => new Date(record.borrowDate || record.createdAt);
  const getReportRange = (filter) => {
    if (!filter) return null;
    if (filter.type === 'month') {
      return {
        start: new Date(filter.year, filter.month - 1, 1),
        end: new Date(filter.year, filter.month, 1),
      };
    }
    if (filter.type === 'fiscalYear') {
      return {
        start: new Date(filter.year - 1, 9, 1),
        end: new Date(filter.year, 9, 1),
      };
    }
    return {
      start: new Date(filter.year, 0, 1),
      end: new Date(filter.year + 1, 0, 1),
    };
  };
  const reportRange = getReportRange(reportFilter);
  const reportBorrows = reportRange
    ? borrows.filter((record) => {
        const borrowDate = getBorrowDate(record);
        return !Number.isNaN(borrowDate.getTime())
          && borrowDate >= reportRange.start
          && borrowDate < reportRange.end;
      })
    : borrows;

  const reportPeriodLabel = reportFilter
    ? reportFilter.type === 'fiscalYear'
      ? `รายงานปีงบประมาณ ${reportFilter.year + 543}`
      : reportFilter.type === 'year'
        ? `รายงานปีปฏิทิน ${reportFilter.year + 543}`
        : `รายงานประจำเดือน ${new Date(reportFilter.year, reportFilter.month - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`
    : 'ข้อมูลทั้งหมด';

  // KPI แสดงสถานะปัจจุบันเสมอ ไม่เปลี่ยนตามตัวกรองรายงาน PDF
  const currentStats = {
    totalItems: items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    borrowed: borrows
      .filter(b => b.status === 'approved')
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0),
    pending: borrows.filter(b => b.status === 'pending').length,
    overdue: borrows
      .filter(b => b.status === 'approved' && b.dueDate && new Date(b.dueDate) < now).length
  };

  const itemPopularity = {};
  reportBorrows.forEach(b => {
    if (b.status === 'approved' || b.status === 'returned') {
      const name = b.item?.name || 'ไม่ทราบชื่อ';
      itemPopularity[name] = (itemPopularity[name] || 0) + (Number(b.quantity) || 0);
    }
  });
  
  const top5ItemsData = Object.keys(itemPopularity)
    .map(name => ({ name, พัสดุ: itemPopularity[name] }))
    .sort((a, b) => b.พัสดุ - a.พัสดุ)
    .slice(0, 5);

  const isDailyTrend = reportFilter?.type === 'month';
  const trendMonthCount = isDailyTrend ? 1 : 12;
  const trendStartDate = reportRange
    ? new Date(reportRange.start.getFullYear(), reportRange.start.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - trendMonthCount + 1, 1);
  const trendEndExclusive = reportRange
    ? reportRange.end
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const periodTotals = new Map();
  const trendSourceBorrows = reportRange ? reportBorrows : borrows;

  trendSourceBorrows.forEach((record) => {
    if (record.status !== 'approved' && record.status !== 'returned') return;
    const borrowDate = getBorrowDate(record);
    if (Number.isNaN(borrowDate.getTime()) || borrowDate < trendStartDate || borrowDate >= trendEndExclusive) return;

    const periodKey = isDailyTrend
      ? `${borrowDate.getFullYear()}-${borrowDate.getMonth()}-${borrowDate.getDate()}`
      : `${borrowDate.getFullYear()}-${borrowDate.getMonth()}`;
    periodTotals.set(periodKey, (periodTotals.get(periodKey) || 0) + (Number(record.quantity) || 0));
  });

  const monthlyTrendData = Array.from({ length: trendMonthCount }, (_, index) => {
    const monthDate = new Date(trendStartDate.getFullYear(), trendStartDate.getMonth() + index, 1);
    const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    return {
      month: monthDate.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      monthTitle: monthDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
      borrowed: periodTotals.get(monthKey) || 0,
    };
  });
  const dailyTrendData = isDailyTrend && reportRange
    ? Array.from({ length: new Date(reportRange.end.getFullYear(), reportRange.end.getMonth(), 0).getDate() }, (_, index) => {
        const day = index + 1;
        const dayKey = `${reportRange.start.getFullYear()}-${reportRange.start.getMonth()}-${day}`;
        return {
          period: String(day),
          periodTitle: new Date(reportRange.start.getFullYear(), reportRange.start.getMonth(), day)
            .toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
          borrowed: periodTotals.get(dayKey) || 0,
        };
      })
    : [];
  const trendData = isDailyTrend
    ? dailyTrendData
    : monthlyTrendData.map((month) => ({
        period: month.month,
        periodTitle: month.monthTitle,
        borrowed: month.borrowed,
      }));
  const trendTotal = trendData.reduce((total, period) => total + (Number(period.borrowed) || 0), 0);

  const isOverdue = (record) =>
    record.status === 'approved' && record.dueDate && new Date(record.dueDate) < now;

  const returnedOnTime = reportBorrows.filter((record) =>
    record.status === 'returned' && record.dueDate && record.returnDate
      && new Date(record.returnDate) <= new Date(record.dueDate)
  ).length;
  const returnedLateOrOverdue = reportBorrows.filter((record) =>
    (record.status === 'returned' && record.dueDate && record.returnDate
      && new Date(record.returnDate) > new Date(record.dueDate)) || isOverdue(record)
  ).length;
  const rejectedCount = reportBorrows.filter((record) => record.status === 'rejected').length;
  const complianceTotal = returnedOnTime + returnedLateOrOverdue + rejectedCount;
  const complianceData = [
    { name: 'คืนตรงเวลา', value: returnedOnTime, color: '#10b981' },
    { name: 'คืนช้า/เกินกำหนด', value: returnedLateOrOverdue, color: '#ef4444' },
    { name: 'ไม่อนุมัติ', value: rejectedCount, color: '#64748b' },
  ];

  const recent5Transactions = [...reportBorrows]
    .sort((a, b) => {
      const priority = (record) => record.status === 'pending' ? 0 : isOverdue(record) ? 1 : 2;
      return priority(a) - priority(b)
        || getBorrowDate(b) - getBorrowDate(a);
    })
    .slice(0, 5);
  const hasBorrowHistoryInReport = reportBorrows.length > 0;

  const handlePrint = () => {
    setIsReportDialogOpen(true);
  };

  const availableReportYears = Array.from(new Set([
    reportType === 'fiscalYear' && currentDate.getMonth() >= 9
      ? currentDate.getFullYear() + 1
      : currentDate.getFullYear(),
    ...borrows
      .map((record) => {
        const borrowDate = getBorrowDate(record);
        if (Number.isNaN(borrowDate.getTime())) return null;
        return reportType === 'fiscalYear'
          ? borrowDate.getFullYear() + (borrowDate.getMonth() >= 9 ? 1 : 0)
          : borrowDate.getFullYear();
      })
      .filter((year) => Number.isFinite(year)),
  ])).sort((a, b) => b - a);

  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat('th-TH', { month: 'long' }).format(new Date(2026, index, 1)),
  }));

  const handleGeneratePdf = () => {
    setReportFilter({
      type: reportType,
      year: Number(reportYear),
      month: Number(reportMonth),
    });
    setIsReportDialogOpen(false);
    window.setTimeout(() => window.print(), 200);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('th-TH');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-xl text-gray-500">กำลังโหลดข้อมูลภาพรวม...</p>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          .report-print-header {
            display: none;
          }

          @media print {
            @page {
              size: A4 landscape;
              margin: 12mm;
            }

            html, body {
              width: 100%;
              height: auto;
              background: #fff !important;
              font-size: 10pt;
            }

            body * {
              visibility: hidden;
            }

            #printable-dashboard, #printable-dashboard * {
              visibility: visible;
            }

            #printable-dashboard {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
              color: #111827 !important;
            }

            .report-print-header {
              display: block !important;
              margin-bottom: 18px;
              padding-bottom: 12px;
              border-bottom: 2px solid #334155;
              text-align: center;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .report-print-header h1 {
              margin: 0 0 4px;
              font-size: 18pt;
              font-weight: 700;
            }

            .report-print-header p {
              margin: 3px 0;
              font-size: 10pt;
            }

            .print-keep-together {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            #printable-dashboard .shadow,
            #printable-dashboard .shadow-md,
            #printable-dashboard .shadow-xl {
              box-shadow: none !important;
            }

            #printable-dashboard .grid {
              gap: 10px !important;
            }

            .no-print {
              display: none !important;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      <div id="printable-dashboard" className="space-y-6">
        <header className="report-print-header">
          <p>มหาวิทยาลัยราชภัฏมหาสารคาม · สำนักงานกองกลาง</p>
          <h1>รายงานสรุปการยืม-คืนพัสดุ</h1>
          <p>{reportPeriodLabel}</p>
          <p>จัดทำเมื่อ {new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </header>

        <div className="flex justify-between items-center pb-2 border-b border-black/10">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📊 ภาพรวมระบบ
            </h2>
            {reportFilter && <p className="mt-1 text-sm font-medium text-gray-500">{reportPeriodLabel}</p>}
          </div>
          <div className="no-print flex items-center gap-3">
            {reportFilter && <span className="text-xs font-medium text-gray-500">{reportPeriodLabel}</span>}
            <button 
              onClick={handlePrint}
              className="no-print bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow flex items-center gap-2 cursor-pointer"
            >
              📄 บันทึกเป็นเอกสาร PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <div className="print-keep-together bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">📦 พัสดุทั้งหมดในคลัง</p>
            <p className="text-2xl font-bold text-gray-800">{formatNumber(currentStats.totalItems)} <span className="text-xs font-medium text-gray-500">ชิ้น</span></p>
          </div>
          <div className="print-keep-together bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">👥 ผู้ใช้งานในระบบทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-800">{formatNumber(allUsers.length)} <span className="text-xs font-medium text-gray-500">บัญชี</span></p>
          </div>
          <div className="print-keep-together bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">🏃 กำลังถูกยืม</p>
            <p className="text-2xl font-bold text-blue-700">{formatNumber(currentStats.borrowed)} <span className="text-xs font-medium text-gray-500">ชิ้น</span></p>
          </div>
          <div className="print-keep-together bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">⏳ คำร้องรออนุมัติ</p>
            <p className="text-2xl font-bold text-amber-600">{formatNumber(currentStats.pending)} <span className="text-xs font-medium text-gray-500">คำร้อง</span></p>
          </div>
          <div className="print-keep-together bg-white border border-black/10 rounded-lg shadow-md p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">⚠️ รายการเกินกำหนดส่ง</p>
            <p className={`text-2xl font-bold ${currentStats.overdue > 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatNumber(currentStats.overdue)} <span className="text-sm font-medium text-gray-500">รายการ</span></p>
          </div>
        </div>

        {!hasBorrowHistoryInReport ? (
          <div className="print-keep-together rounded-xl border border-blue-200 bg-blue-50 p-8 text-center">
            <div className="mb-3 text-4xl">📄</div>
            <h3 className="text-lg font-bold text-gray-800">ไม่พบประวัติการยืมพัสดุในช่วงเวลาที่เลือก</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
              {reportFilter
                ? `${reportPeriodLabel}ไม่มีรายการยืมพัสดุ เอกสาร PDF นี้ใช้ยืนยันการไม่มีรายการยืมในช่วงเวลาดังกล่าว`
                : 'ขณะนี้ยังไม่มีรายการยืมพัสดุในระบบ สามารถบันทึกเอกสารนี้เพื่อยืนยันสถานะปัจจุบันได้'}
            </p>
          </div>
        ) : (
          <>
        <div className="grid grid-cols-1 gap-6">
          <div className="print-keep-together bg-white p-4 rounded-xl border border-black/10 shadow-md">
            <h3 className="text-sm font-bold text-gray-700">📈 แนวโน้มการยืมรายเดือน</h3>
            <p className="mb-4 mt-1 text-xs text-gray-500">
              {reportFilter?.type === 'month'
                ? `จำนวนชิ้นที่ยืมในแต่ละวันของเดือน ${reportPeriodLabel.replace('รายงานประจำเดือน ', '')}`
                : `จำนวนชิ้นที่ยืมรายเดือน ${reportFilter ? `ใน${reportPeriodLabel}` : 'ย้อนหลัง 12 เดือน'}`}
            </p>
            {trendTotal > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <LineChart data={trendData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} interval={isDailyTrend ? 2 : 0} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.periodTitle || ''}
                      formatter={(value) => [`${formatNumber(value)} ชิ้น`, 'ยืม']}
                    />
                    <Line type="monotone" dataKey="borrowed" name="จำนวนที่ยืม" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3, fill: '#7c3aed' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 px-4 text-center text-sm text-gray-500">
                ไม่พบประวัติการยืมพัสดุในช่วงเวลาที่เลือก
              </div>
            )}
          </div>

          <div className="print-keep-together bg-white p-4 rounded-xl border border-black/10 shadow-md">
            <h3 className="text-sm font-bold text-gray-700">🏆 5 อันดับพัสดุที่ถูกยืมมากที่สุด</h3>
            <p className="mb-4 mt-1 text-xs text-gray-500">ปริมาณการยืมสะสม{reportFilter ? ` — ${reportPeriodLabel}` : ''}</p>
            {top5ItemsData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={top5ItemsData} layout="vertical" margin={{ top: 4, right: 16, left: 12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                    <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [`${formatNumber(value)} ชิ้น`, 'ยืมสะสม']} />
                    <Bar dataKey="พัสดุ" name="ยืมสะสม" radius={[0, 6, 6, 0]} barSize={24}>
                      {top5ItemsData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 px-4 text-center text-sm text-gray-500">
                ไม่พบประวัติการยืมพัสดุในช่วงเวลาที่เลือก
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="print-keep-together bg-white p-4 rounded-xl border border-black/10 shadow-md">
            <h3 className="text-sm font-bold text-gray-700">🍩 สัดส่วนผลการยืม-คืน</h3>
            <p className="mb-3 mt-1 text-xs text-gray-500">ไม่รวมคำร้องรออนุมัติและรายการที่ยังไม่ถึงกำหนดคืน{reportFilter ? ` — ${reportPeriodLabel}` : ''}</p>
            <div className="h-64 w-full">
              {complianceTotal > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={complianceData}
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {complianceData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${formatNumber(value)} รายการ (${((Number(value) / complianceTotal) * 100).toFixed(1)}%)`, name]} />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      wrapperStyle={{ fontSize: '12px' }}
                      content={({ payload = [] }) => (
                        <ul className="space-y-3 text-xs">
                          {payload.map((entry) => {
                            const percentage = complianceTotal ? (Number(entry.payload.value) / complianceTotal) * 100 : 0;
                            return (
                              <li key={entry.value} className="flex items-center gap-2 text-gray-700">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span>{entry.value}</span>
                                <span className="font-semibold">{percentage.toFixed(1)}%</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  ยังไม่มีรายการที่สรุปผลได้ในช่วงนี้
                </div>
              )}
            </div>
          </div>

          <div className="print-keep-together bg-white rounded-xl border border-black/10 shadow-md p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-1">🚨 รายการที่ต้องติดตามด่วน</h3>
          <p className="mb-4 text-xs text-gray-500">รออนุมัติและเกินกำหนดจะอยู่ด้านบน{reportFilter ? ` — ${reportPeriodLabel}` : ''}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-gray-600">
                  <th className="py-2 font-semibold">พัสดุ</th>
                  <th className="py-2 font-semibold text-center">วันที่ยืม</th>
                  <th className="py-2 font-semibold text-center">กำหนดคืน</th>
                  <th className="py-2 font-semibold text-center">ผู้ยืม</th>
                  <th className="py-2 font-semibold text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {recent5Transactions.length > 0 ? (
                  recent5Transactions.map(record => (
                    <tr key={record._id} className="border-b border-black/10 last:border-0 hover:bg-gray-50">
                      <td className="py-3 text-gray-800">
                        {record.item?.name || 'ไม่ทราบชื่อ'} <span className="text-gray-400 text-xs">(x{formatNumber(record.quantity)})</span>
                      </td>
                      <td className="py-3 text-center text-gray-600">{formatDate(record.borrowDate || record.createdAt)}</td>
                      <td className="py-3 text-center text-gray-600">{record.status === 'pending' || record.status === 'rejected' ? '-' : formatDate(record.dueDate)}</td>
                      <td className="py-3 text-center text-gray-600">{record.user?.fullName || record.user?.username || 'ไม่ทราบชื่อ'}</td>
                      <td className="py-3 text-center">
                        {record.status === 'pending' && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">รออนุมัติ</span>}
                        {isOverdue(record) && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">เกินกำหนด</span>}
                        {record.status === 'approved' && !isOverdue(record) && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">กำลังยืม</span>}
                        {record.status === 'returned' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">คืนแล้ว</span>}
                        {record.status === 'rejected' && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">ไม่อนุมัติ</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-gray-500">ไม่มีรายการให้ติดตามในช่วงนี้</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
          </>
        )}

      </div>
      {isReportDialogOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
          >
            <h3 id="report-dialog-title" className="text-lg font-bold text-gray-800">
              เลือกช่วงเวลารายงาน
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              เลือกได้ทั้งรายเดือน ปีปฏิทิน หรือปีงบประมาณ (1 ต.ค.–30 ก.ย.); กราฟและตารางใช้ช่วงที่เลือก ส่วน KPI เป็นสถานะปัจจุบัน
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                aria-pressed={reportType === 'month'}
                onClick={() => {
                  setReportType('month');
                  setReportYear(currentDate.getFullYear());
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${reportType === 'month' ? 'border-purple-700 bg-purple-700 text-white' : 'border-gray-200 text-gray-700 hover:bg-purple-50'}`}
              >
                รายเดือน
              </button>
              <button
                type="button"
                aria-pressed={reportType === 'year'}
                onClick={() => {
                  setReportType('year');
                  setReportYear(currentDate.getFullYear());
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${reportType === 'year' ? 'border-purple-700 bg-purple-700 text-white' : 'border-gray-200 text-gray-700 hover:bg-purple-50'}`}
              >
                ปีปฏิทิน
              </button>
              <button
                type="button"
                aria-pressed={reportType === 'fiscalYear'}
                onClick={() => {
                  setReportType('fiscalYear');
                  setReportYear(currentDate.getFullYear() + (currentDate.getMonth() >= 9 ? 1 : 0));
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${reportType === 'fiscalYear' ? 'border-purple-700 bg-purple-700 text-white' : 'border-gray-200 text-gray-700 hover:bg-purple-50'}`}
              >
                ปีงบประมาณ (ต.ค. – ก.ย.)
              </button>
            </div>

            <div className={`mt-4 grid gap-3 ${reportType === 'month' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {reportType === 'month' && (
                <label className="block text-sm font-medium text-gray-700">
                  เดือน
                  <select
                    value={reportMonth}
                    onChange={(event) => setReportMonth(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  >
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-medium text-gray-700">
                ปี พ.ศ.
                <select
                  value={reportYear}
                  onChange={(event) => setReportYear(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                >
                  {availableReportYears.map((year) => (
                    <option key={year} value={year}>{year + 543}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReportDialogOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleGeneratePdf}
                className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-red-600"
              >
                สร้าง PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}