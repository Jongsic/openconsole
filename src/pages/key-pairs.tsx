import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader, ResourceTable, Td, Th, Tr } from "@/components/kit";
import { useToast } from "@/components/toast";
import { Button, Field, Modal, Select, Textarea, TextInput } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2KeyPairSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function KeyPairsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const keys = useQuery({ queryKey: ["key-pairs"], queryFn: api.listKeyPairs });

  const del = useMutation({
    mutationFn: (name: string) => api.deleteKeyPair(name),
    onSuccess: (_d, name) => {
      toast.success(t("kp.deleted", { name }));
      qc.invalidateQueries({ queryKey: ["key-pairs"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={KeyRound}
        title={t("kp.heading")}
        subtitle={t("kp.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["key-pairs"] })}
        refreshing={keys.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> {t("kp.import")}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t("kp.create")}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={keys.isLoading}
          isError={keys.isError}
          error={keys.error}
          service="EC2 key pairs"
          data={keys.data}
          getKey={(k) => k.keyPairId || k.keyName}
          empty={{ icon: KeyRound, message: t("kp.none") }}
          head={
            <tr>
              <Th>{t("kp.col.name")}</Th>
              <Th>{t("kp.col.id")}</Th>
              <Th>{t("kp.col.type")}</Th>
              <Th>{t("kp.col.fingerprint")}</Th>
              <Th>{t("kp.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(k: Ec2KeyPairSummary) => (
            <Tr key={k.keyPairId || k.keyName}>
              <Td className="font-medium text-slate-700">{k.keyName}</Td>
              <Td mono>{k.keyPairId}</Td>
              <Td>{k.keyType ?? "—"}</Td>
              <Td className="font-mono text-[11px] text-slate-500">{k.fingerprint ?? "—"}</Td>
              <Td muted>{formatDate(k.createTime, i18n.language)}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={() => setDeleteTarget(k.keyName)}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      <CreateKeyPairModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ImportKeyPairModal open={importOpen} onClose={() => setImportOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("kp.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("kp.deleteConfirm", { name: deleteTarget })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CreateKeyPairModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState<"rsa" | "ed25519">("rsa");

  const create = useMutation({
    mutationFn: () => api.createKeyPair(name.trim(), keyType),
    onSuccess: ({ keyName, keyMaterial }) => {
      // Download the private key — it is only returned once, at creation time.
      if (keyMaterial) {
        const blob = new Blob([keyMaterial], { type: "application/x-pem-file" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${keyName}.pem`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(t("kp.created", { name: keyName }));
      qc.invalidateQueries({ queryKey: ["key-pairs"] });
      setName("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("kp.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("kp.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-key"
            autoComplete="off"
          />
        </Field>
        <Field label={t("kp.type")}>
          <Select value={keyType} onChange={(e) => setKeyType(e.target.value as "rsa" | "ed25519")}>
            <option value="rsa">RSA</option>
            <option value="ed25519">ED25519</option>
          </Select>
        </Field>
        <p className="text-xs text-amber-600">{t("kp.downloadNote")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportKeyPairModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const imp = useMutation({
    mutationFn: () => api.importKeyPair(name.trim(), publicKey.trim()),
    onSuccess: () => {
      toast.success(t("kp.imported", { name }));
      qc.invalidateQueries({ queryKey: ["key-pairs"] });
      setName("");
      setPublicKey("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("kp.importTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("kp.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-key"
            autoComplete="off"
          />
        </Field>
        <Field label={t("kp.publicKey")}>
          <Textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            spellCheck={false}
            placeholder="ssh-ed25519 AAAA... user@host"
            className="h-28 w-full p-2 font-mono text-xs"
          />
        </Field>
        <p className="text-xs text-slate-400">{t("kp.importNote")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={imp.isPending}
            disabled={!name.trim() || !publicKey.trim()}
            onClick={() => imp.mutate()}
          >
            {t("kp.import")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
