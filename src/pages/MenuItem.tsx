import { useState } from "react";
import styles from "./MenuItem.module.css";
interface SubMenuItem {
  label: string;
  onClick: () => void;
}
interface DropdownItem {
  label: string;
  onClick: () => void;
  isDivider?: boolean;
  checked?: boolean;
  testId?: string;
  submenu?: SubMenuItem[];
}
interface MenuItemProps {
  title: string;
  dropdownItems?: DropdownItem[];
}
export default function MenuItem({ title, dropdownItems }: MenuItemProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState<number | null>(null);
  const hasDropdown = dropdownItems && dropdownItems.length > 0;
  const handleMouseEnter = () => {
    if (hasDropdown) setIsDropdownOpen(true);
  };
  const handleMouseLeave = () => {
    if (hasDropdown) {
      setIsDropdownOpen(false);
      setHoveredSubmenu(null);
    }
  };
  const handleItemClick = (item: DropdownItem) => {
    if (!item.isDivider && !item.submenu) {
      item.onClick();
      setIsDropdownOpen(false);
    }
  };
  const handleSubmenuItemClick = (subItem: SubMenuItem) => {
    subItem.onClick();
    setIsDropdownOpen(false);
    setHoveredSubmenu(null);
  };
  return (
    <div
      className={styles.menuItem}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {title}
      {hasDropdown && isDropdownOpen && (
        <div className={styles.dropdown}>
          {dropdownItems.map((item, index) => (
            <div
              key={index}
              className={item.isDivider ? styles.divider : styles.dropdownItem}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => item.submenu && setHoveredSubmenu(index)}
              data-testid={item.testId}
            >
              {item.isDivider ? null : (
                <>
                  {item.label}
                  {item.submenu && hoveredSubmenu === index && (
                    <div className={styles.submenu}>
                      {item.submenu.map((subItem, subIndex) => (
                        <div
                          key={subIndex}
                          className={styles.submenuItem}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubmenuItemClick(subItem);
                          }}
                        >
                          {subItem.label}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
