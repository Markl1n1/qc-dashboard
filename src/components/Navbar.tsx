
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Settings, Upload, Home } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold">
              VoiceQC
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link to="/upload">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </Link>
              <Link to="/settings">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
