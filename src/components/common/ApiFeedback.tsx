import { useId } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
} from "@mui/material";
import type { OmadaError } from "../../services/omadaClient";

export function Loading({ show }: { show: boolean }) {
  return show ? <LinearProgress sx={{ mb: 2 }} /> : null;
}

export function ApiErrorDialog({
  error,
  onClose,
  title = "Unable to complete request",
}: {
  error: unknown;
  onClose: () => void;
  title?: string;
}) {
  const id = useId();
  const e = error as OmadaError | undefined;
  const message =
    typeof error === "string"
      ? error
      : e?.message || "Something went wrong. Please try again.";
  const details =
    e && typeof e === "object"
      ? e.details || (e.code ? { code: e.code } : undefined)
      : undefined;
  return (
    <Dialog
      open={!!error}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      slotProps={{ paper: { role: "alertdialog" } }}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText
          id={`${id}-message`}
          sx={{ overflowWrap: "anywhere" }}
        >
          {message}
        </DialogContentText>
        {details && (
          <Box component="details" sx={{ mt: 2 }}>
            <summary>Technical details</summary>
            <Box
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                fontSize: 12,
              }}
            >
              {JSON.stringify(details, null, 2)}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
