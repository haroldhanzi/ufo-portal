import { useId, useState, type MouseEvent, type ReactNode } from "react";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";

export interface ActionItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  color?: "inherit" | "error";
  disabled?: boolean;
}

export default function ActionsMenu({
  items,
  label = "Open actions",
}: {
  items: ActionItem[];
  label?: string;
}) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = (event: MouseEvent<HTMLElement>) =>
    setAnchor(event.currentTarget);
  const close = () => setAnchor(null);
  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          aria-label={label}
          aria-controls={anchor ? menuId : undefined}
          aria-haspopup="menu"
          onClick={open}
        >
          <SettingsOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.label}
            disabled={item.disabled}
            sx={item.color === "error" ? { color: "error.main" } : undefined}
            onClick={() => {
              close();
              item.onClick();
            }}
          >
            {item.icon && (
              <ListItemIcon
                sx={
                  item.color === "error" ? { color: "error.main" } : undefined
                }
              >
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
