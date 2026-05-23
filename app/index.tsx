import { DefaultTabRedirect } from "@/components/navigation/DefaultTabRedirect";
import { ProductLandingPage } from "@/components/marketing/ProductLandingPage";
import { useAuthStore } from "@/store/authStore";

export default function IndexRoute() {
  const user = useAuthStore((state) => state.user);
  if (user) return <DefaultTabRedirect />;
  return <ProductLandingPage />;
}
