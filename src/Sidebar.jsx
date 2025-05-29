function Sidebar({ isOpen }) {
  const location = useLocation();

  const navLinks = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Generator", path: "/generator", icon: Sparkles },
    { label: "Auto Generator", path: "/auto-generator", icon: Wand2 },
    { label: "AI Chat", path: "/chatboard", icon: Bot },
    // ...add the rest
  ];

  return (
    <div className="h-full bg-[#111] border-r border-gray-800 p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-6">{isOpen ? "Droxion" : "🚀"}</h1>
      <div className="flex flex-col gap-2">
        {navLinks.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#1f2937] transition ${
              location.pathname === path ? "bg-[#1f2937] text-green-400" : "text-gray-300"
            }`}
          >
            <Icon size={20} />
            {isOpen && <span>{label}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
