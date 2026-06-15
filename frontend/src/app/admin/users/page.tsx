export default function AdminUsersPage() {
  return (
    <section>
      <h1 className="text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
        用户管理
      </h1>
      <p className="mt-2 text-[14px] text-mute leading-relaxed max-w-[68ch]">
        这里会接入用户列表、搜索筛选、角色调整和账号启停。完整功能由用户管理子任务实现。
      </p>
    </section>
  );
}
