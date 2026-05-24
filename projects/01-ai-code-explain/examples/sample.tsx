// @ts-nocheck — 这是 AI 分析的测试输入文件，不需要类型检查
import { useUserInfo } from "@/hooks/useUserInfo";
import { BannerSwiper } from "@/components/BannerSwiper";
import { ActivityCard } from "@/components/ActivityCard";
import { getUserActivities } from "@/api/home";

export default function HomePage() {
  const { user, loading, error } = useUserInfo();
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    getUserActivities().then(setActivities);
  }, []);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;

  return (
    <div className="home-page">
      <BannerSwiper />
      {activities.map((item) => (
        <ActivityCard key={item.id} data={item} />
      ))}
    </div>
  );
}
