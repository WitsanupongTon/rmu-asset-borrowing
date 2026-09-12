export default function LoadingState({ message = 'กำลังโหลดข้อมูล...' }) {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-700" />
        <p className="text-sm font-medium text-gray-500">{message}</p>
      </div>
    </div>
  );
}