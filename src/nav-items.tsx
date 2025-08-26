
import { HomeIcon, UploadIcon, SettingsIcon, FileTextIcon } from "lucide-react";
import Index from "./pages/Index";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";
import DialogDetail from "./pages/DialogDetail";

export const navItems = [
  {
    title: "Dashboard",
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
    title: "Dialog Detail",
    to: "/dialog/:id",
    icon: <FileTextIcon className="h-4 w-4" />,
    page: <DialogDetail />,
    hideFromNav: true,
  },
];
