import { LucideIcon } from "lucide-react";
import React from "react";

interface SettingMenuItemProps {
  text: string;
  icon: LucideIcon;
  isSelected: boolean;
  onClick: () => void;
}

const SectionMenuItem: React.FC<SettingMenuItemProps> = ({ text, icon: IconComponent, isSelected, onClick }) => {
  return (
    <span
      onClick={onClick}
      className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg select-none hover:opacity-80 ${
        isSelected ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
      }`}
    >
      <IconComponent className="w-4 h-auto mr-2 opacity-80" /> {text}
    </span>
  );
};

export default SectionMenuItem;
