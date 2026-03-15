import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem as CommandItemPrimitive,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

export interface CommandItem {
  id: string;
  label: string;
  group: "Files" | "Threads" | "Actions";
  icon?: React.ReactNode;
  shortcut?: string;
  onAction: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

const GROUPS = ["Files", "Threads", "Actions"] as const;

export function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const grouped = GROUPS.reduce<Record<string, CommandItem[]>>((acc, group) => {
    acc[group] = items.filter((item) => item.group === group);
    return acc;
  }, {});

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="overflow-hidden border-[var(--border-default)] bg-[var(--bg-surface)] p-0 text-[var(--text-primary)]"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>
            Search files, threads, and actions
          </DialogDescription>
        </DialogHeader>
        <Command
          filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
          className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
        >
          <CommandInput
            placeholder="Search files, threads, actions..."
            className="text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            aria-label="Command palette search"
          />
          <CommandList className="max-h-80">
            <CommandEmpty className="text-[var(--text-muted)]">
              No results found
            </CommandEmpty>
            {GROUPS.map((group) => {
              const groupItems = grouped[group];
              if (!groupItems?.length) return null;
              return (
                <CommandGroup
                  key={group}
                  heading={group}
                  className="text-[var(--text-muted)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {groupItems.map((item) => (
                    <CommandItemPrimitive
                      key={item.id}
                      value={item.label}
                      onSelect={() => {
                        item.onAction();
                        onClose();
                      }}
                      className="text-[var(--text-secondary)] data-[selected=true]:bg-[var(--accent-blue-muted)] data-[selected=true]:text-[var(--text-primary)]"
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 text-[var(--text-tertiary)]">
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && (
                        <CommandShortcut>
                          <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                            {item.shortcut}
                          </kbd>
                        </CommandShortcut>
                      )}
                    </CommandItemPrimitive>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
          <div className="border-t border-[var(--border-default)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
            <span className="mr-3">&#8593;&#8595; navigate</span>
            <span className="mr-3">&#8629; select</span>
            <span>esc close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
