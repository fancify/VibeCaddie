import AppNav from "@/components/nav/app-nav";
import { PageContainer } from "@/components/ui/page-container";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppNav />
      {/* 主内容区域：桌面端为侧边栏留出左边距，移动端为底部导航留出下边距 */}
      <main className="lg:ml-[240px] pb-20 lg:pb-0">
        <PageContainer>
          {children}
        </PageContainer>
      </main>
    </div>
  );
}
