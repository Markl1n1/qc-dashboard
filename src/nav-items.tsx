
import { HomeIcon, SettingsIcon, UploadIcon, UserIcon } from "lucide-react";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Upload from "./pages/Upload";
import Auth from "./pages/Auth";
import DialogDetail from "./pages/DialogDetail";
import NotFound from "./pages/NotFound";

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Upload",
    to: "/upload",
    icon: <UploadIcon className="h-4 w-4" />,
    page: <Upload />,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Settings />,
  },
  {
    title: "Auth",
    to: "/auth",
    icon: <UserIcon className="h-4 w-4" />,
    page: <Auth />,
  },
  {
    title: "Dialog Detail",
    to: "/dialog/:id",
    page: <DialogDetail />,
  },
  {
    title: "Not Found",
    to: "*",
    page: <NotFound />,
  },
];
