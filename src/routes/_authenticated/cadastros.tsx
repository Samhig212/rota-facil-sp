import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Download,
  Eye,
  FileCheck2,
  FileText,
  IdCard,
  Image as ImageIcon,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, Plate } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { driversQuery, vehiclesQuery, type Driver } from "@/lib/fleet";
import {
  getDriverProfile,
  saveDriverProfile,
  useDriverProfile,
  type DriverProfile,
} from "@/lib/driver-profiles";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Frota e motoristas — RotaFacil SP" },
      { name: "description", content: "Cadastro de veículos e motoristas da frota própria." },
      { property: "og:title", content: "Frota e motoristas — RotaFacil SP" },
      { property: "og:description", content: "Cadastro de veículos e motoristas da frota própria." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(vehiclesQuery),
      context.queryClient.ensureQueryData(driversQuery),
    ]),
  component: CadastrosPage,
});

const CNH_CATEGORIES = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];

function CadastrosPage() {
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery);
  const { data: drivers } = useSuspenseQuery(driversQuery);
  const qc = useQueryClient();

  // State Veículos
  const [v, setV] = useState({ placa: "", modelo: "", km: "" });
  const [vSearch, setVSearch] = useState("");

  // State Motoristas Form
  const [d, setD] = useState({
    nome: "",
    cnh: "",
    telefone: "",
    cnhCategoria: "D",
    cnhValidade: "",
  });
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [cnhPreview, setCnhPreview] = useState<string>("");
  const [dSearch, setDSearch] = useState("");
  const [submittingDriver, setSubmittingDriver] = useState(false);

  // Modais
  const [selectedDriverForCnh, setSelectedDriverForCnh] = useState<Driver | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editFoto, setEditFoto] = useState("");
  const [editCnhFoto, setEditCnhFoto] = useState("");
  const [editCategoria, setEditCategoria] = useState("B");

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const cnhInputRef = useRef<HTMLInputElement>(null);
  const editFotoInputRef = useRef<HTMLInputElement>(null);
  const editCnhInputRef = useRef<HTMLInputElement>(null);

  async function runOp(action: () => Promise<any>, key: string, okMsg: string) {
    try {
      await action();
      toast.success(okMsg);
      qc.invalidateQueries({ queryKey: [key] });
      return true;
    } catch (err: any) {
      toast.error(err.message || "Erro na operação");
      return false;
    }
  }

  function handleFileToDataUrl(file: File, callback: (url: string) => void) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Formato inválido. Selecione uma imagem (PNG, JPG, WEBP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) callback(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleCreateDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!d.nome.trim()) {
      toast.error("Informe o nome do motorista");
      return;
    }
    setSubmittingDriver(true);

    try {
      const newDriver = await api.drivers.create({
        nome: d.nome.trim(),
        cnh: d.cnh.trim(),
        telefone: d.telefone.trim(),
        foto: fotoPreview || undefined,
        cnh_foto: cnhPreview || undefined,
        cnh_categoria: d.cnhCategoria,
        cnh_validade: d.cnhValidade || undefined,
      });

      // Salva anexo de foto e CNH no perfil associado
      const targetId = newDriver?.id || d.cnh.trim() || d.nome;
      saveDriverProfile(
        targetId,
        {
          foto: fotoPreview || undefined,
          cnhFoto: cnhPreview || undefined,
          cnhCategoria: d.cnhCategoria,
          cnhValidade: d.cnhValidade || undefined,
        },
        d.cnh.trim(),
      );

      toast.success("Motorista, foto e CNH cadastrados com sucesso!");
      qc.invalidateQueries({ queryKey: ["drivers"] });

      // Reset
      setD({ nome: "", cnh: "", telefone: "", cnhCategoria: "D", cnhValidade: "" });
      setFotoPreview("");
      setCnhPreview("");
      if (fotoInputRef.current) fotoInputRef.current.value = "";
      if (cnhInputRef.current) cnhInputRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar motorista");
    } finally {
      setSubmittingDriver(false);
    }
  }

  function openEditModal(driver: Driver) {
    setEditingDriver(driver);
    const prof = getDriverProfile(driver.id) || getDriverProfile(driver.cnh);
    setEditFoto(driver.foto || prof?.foto || "");
    setEditCnhFoto(driver.cnh_foto || prof?.cnhFoto || "");
    setEditCategoria(driver.cnh_categoria || prof?.cnhCategoria || "B");
  }

  async function handleSaveEditProfile() {
    if (!editingDriver) return;
    try {
      await api.drivers.update(editingDriver.id, {
        foto: editFoto || undefined,
        cnh_foto: editCnhFoto || undefined,
        cnh_categoria: editCategoria,
      });
      saveDriverProfile(
        editingDriver.id,
        {
          foto: editFoto || undefined,
          cnhFoto: editCnhFoto || undefined,
          cnhCategoria: editCategoria,
        },
        editingDriver.cnh,
      );
      toast.success(`Foto e CNH de ${editingDriver.nome} atualizadas com sucesso!`);
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setEditingDriver(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar dados");
    }
  }

  const filteredVehicles = useMemo(() => {
    const s = vSearch.toLowerCase().trim();
    if (!s) return vehicles;
    return vehicles.filter(
      (x) => x.placa.toLowerCase().includes(s) || (x.modelo && x.modelo.toLowerCase().includes(s)),
    );
  }, [vehicles, vSearch]);

  const filteredDrivers = useMemo(() => {
    const s = dSearch.toLowerCase().trim();
    if (!s) return drivers;
    return drivers.filter(
      (x) =>
        x.nome.toLowerCase().includes(s) ||
        x.cnh.includes(s) ||
        (x.telefone && x.telefone.includes(s)),
    );
  }, [drivers, dSearch]);

  const activeDriverCnhProfile = selectedDriverForCnh
    ? {
        foto: selectedDriverForCnh.foto || (getDriverProfile(selectedDriverForCnh.id) || getDriverProfile(selectedDriverForCnh.cnh))?.foto,
        cnhFoto: selectedDriverForCnh.cnh_foto || (getDriverProfile(selectedDriverForCnh.id) || getDriverProfile(selectedDriverForCnh.cnh))?.cnhFoto,
        cnhCategoria: selectedDriverForCnh.cnh_categoria || (getDriverProfile(selectedDriverForCnh.id) || getDriverProfile(selectedDriverForCnh.cnh))?.cnhCategoria,
      }
    : null;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Frota & Motoristas"
        subtitle="Gerenciamento corporativo de veículos, perfil de condutores e documentação de CNH"
      />

      <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-2">
        {/* Bento Card: Veículos */}
        <section className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Truck size={19} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-foreground">
                  Veículos da Frota
                </h2>
                <p className="text-xs text-muted-foreground font-normal">
                  {vehicles.filter((x) => x.ativo).length} operacionais de {vehicles.length} na base
                </p>
              </div>
            </div>

            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={vSearch}
                onChange={(e) => setVSearch(e.target.value)}
                placeholder="Buscar placa..."
                className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
              />
            </div>
          </div>

          {/* Formulário de Adicionar Veículo */}
          <form
            className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] gap-2 border-b border-border/60 p-4 bg-muted/10"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await runOp(
                () =>
                  api.vehicles.create({
                    placa: v.placa.toUpperCase(),
                    modelo: v.modelo,
                    km_atual: Number(v.km) || 0,
                  }),
                "vehicles",
                "Veículo cadastrado com sucesso",
              );
              if (ok) {
                setV({ placa: "", modelo: "", km: "" });
              }
            }}
          >
            <Input
              required
              placeholder="Placa (ABC1D23)"
              className="font-mono uppercase text-xs rounded-xl"
              value={v.placa}
              maxLength={8}
              onChange={(e) => setV({ ...v, placa: e.target.value })}
            />
            <Input
              placeholder="Modelo (ex: Sprinter, HR)"
              className="text-xs rounded-xl"
              value={v.modelo}
              onChange={(e) => setV({ ...v, modelo: e.target.value })}
            />
            <Input
              type="number"
              placeholder="KM atual"
              className="font-mono text-xs rounded-xl"
              value={v.km}
              onChange={(e) => setV({ ...v, km: e.target.value })}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-sm"
              aria-label="Adicionar veículo"
              title="Cadastrar veículo"
            >
              <Plus size={16} />
            </Button>
          </form>

          {/* Lista de Veículos */}
          <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[540px]">
            {filteredVehicles.length === 0 ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Nenhum veículo encontrado.
              </p>
            ) : (
              filteredVehicles.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <Plate>{x.placa}</Plate>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{x.modelo}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {x.km_atual.toLocaleString("pt-BR")} km registrados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {x.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={Boolean(x.ativo)}
                      onCheckedChange={(c) =>
                        runOp(
                          () => api.vehicles.update(x.id, { ativo: c }),
                          "vehicles",
                          c ? "Veículo ativado" : "Veículo inativado",
                        )
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Bento Card: Motoristas & Documentos CNH */}
        <section className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Users size={19} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-foreground">
                  Motoristas & Equipe Autorizada
                </h2>
                <p className="text-xs text-muted-foreground font-normal">
                  {drivers.filter((x) => x.ativo).length} habilitados · Registro de foto & CNH digital
                </p>
              </div>
            </div>

            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={dSearch}
                onChange={(e) => setDSearch(e.target.value)}
                placeholder="Buscar motorista..."
                className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
              />
            </div>
          </div>

          {/* Formulário Completo: Foto do Motorista e CNH */}
          <form
            onSubmit={handleCreateDriver}
            className="border-b border-border/60 p-5 bg-muted/10 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Nome do Motorista *
                </Label>
                <Input
                  required
                  placeholder="Nome completo"
                  className="text-xs rounded-xl"
                  value={d.nome}
                  onChange={(e) => setD({ ...d, nome: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Número da CNH *
                </Label>
                <Input
                  required
                  placeholder="Registro CNH (11 dígitos)"
                  className="font-mono text-xs rounded-xl"
                  value={d.cnh}
                  maxLength={14}
                  onChange={(e) => setD({ ...d, cnh: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Telefone / WhatsApp
                </Label>
                <Input
                  placeholder="(11) 98888-0000"
                  className="text-xs rounded-xl"
                  value={d.telefone}
                  onChange={(e) => setD({ ...d, telefone: e.target.value })}
                />
              </div>
            </div>

            {/* Linha dos campos de Anexo: Foto do Motorista e Documento CNH */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Campo: Foto do Motorista */}
              <div className="rounded-xl border border-border/70 p-3 bg-card/60 flex items-center gap-3">
                <input
                  type="file"
                  ref={fotoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileToDataUrl(file, setFotoPreview);
                  }}
                />

                <div className="relative h-12 w-12 shrink-0 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Prévia do Motorista"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground/60" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Camera size={13} className="text-primary" /> Foto do Motorista
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {fotoPreview ? "Foto carregada" : "Formatos: JPG, PNG, WEBP"}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {fotoPreview ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setFotoPreview("");
                        if (fotoInputRef.current) fotoInputRef.current.value = "";
                      }}
                    >
                      <X size={14} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-lg gap-1 border-dashed"
                      onClick={() => fotoInputRef.current?.click()}
                    >
                      <Upload size={12} /> Anexar
                    </Button>
                  )}
                </div>
              </div>

              {/* Campo: Foto da CNH */}
              <div className="rounded-xl border border-border/70 p-3 bg-card/60 flex items-center gap-3">
                <input
                  type="file"
                  ref={cnhInputRef}
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileToDataUrl(file, setCnhPreview);
                  }}
                />

                <div className="relative h-12 w-12 shrink-0 rounded-lg border-2 border-border overflow-hidden bg-muted flex items-center justify-center">
                  {cnhPreview ? (
                    <img
                      src={cnhPreview}
                      alt="Prévia CNH"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <IdCard className="h-6 w-6 text-muted-foreground/60" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileCheck2 size={13} className="text-blue-600" /> Foto da CNH
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {cnhPreview ? "Documento anexado" : "Scan/Foto da CNH física ou digital"}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {cnhPreview ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setCnhPreview("");
                        if (cnhInputRef.current) cnhInputRef.current.value = "";
                      }}
                    >
                      <X size={14} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] rounded-lg gap-1 border-dashed"
                      onClick={() => cnhInputRef.current?.click()}
                    >
                      <Upload size={12} /> Anexar CNH
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-medium">Categoria CNH:</span>
                <div className="flex gap-1">
                  {["B", "C", "D", "E"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setD({ ...d, cnhCategoria: cat })}
                      className={`h-6 px-2 text-[10px] font-mono font-bold rounded-md border transition-all ${
                        d.cnhCategoria === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      Cat. {cat}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={submittingDriver}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/20 text-xs px-4 h-8 gap-1.5"
              >
                <Plus size={14} /> Cadastrar Motorista & CNH
              </Button>
            </div>
          </form>

          {/* Lista de Motoristas Cadastrados */}
          <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[500px]">
            {filteredDrivers.length === 0 ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Nenhum motorista cadastrado no sistema.
              </p>
            ) : (
              filteredDrivers.map((driver) => {
                const profile = getDriverProfile(driver.id) || getDriverProfile(driver.cnh);
                const photoSrc = driver.foto || profile?.foto;
                const cnhSrc = driver.cnh_foto || profile?.cnhFoto;
                const cat = driver.cnh_categoria || profile?.cnhCategoria;

                return (
                  <div
                    key={driver.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    {/* Foto ou Monograma do Motorista */}
                    <div className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-border/80 bg-muted/60 flex items-center justify-center font-bold text-xs text-foreground uppercase shadow-xs">
                      {photoSrc ? (
                        <img
                          src={photoSrc}
                          alt={driver.nome}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{driver.nome.slice(0, 2)}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{driver.nome}</p>
                        {cat && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
                            Cat. {cat}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono">
                          CNH: {driver.cnh || "Não informada"}
                        </span>
                        <span>·</span>
                        <span>{driver.telefone || "Sem telefone"}</span>
                      </div>
                    </div>

                    {/* Ações: Ver CNH, Editar Foto/CNH, Ativo/Inativo */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={`h-7 px-2.5 rounded-lg text-xs gap-1 font-semibold ${
                          cnhSrc
                            ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                            : "text-muted-foreground"
                        }`}
                        title="Visualizar CNH"
                        onClick={() => setSelectedDriverForCnh(driver)}
                      >
                        <Eye size={13} />
                        <span className="hidden sm:inline">Ver CNH</span>
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                        title="Editar Foto & CNH"
                        onClick={() => openEditModal(driver)}
                      >
                        <Camera size={14} />
                      </Button>

                      <Switch
                        checked={Boolean(driver.ativo)}
                        onCheckedChange={(c) =>
                          runOp(
                            () => api.drivers.update(driver.id, { ativo: c }),
                            "drivers",
                            c ? "Motorista ativado" : "Motorista inativado",
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Modal: Visualizador de CNH & Ficha do Condutor */}
      <Dialog
        open={Boolean(selectedDriverForCnh)}
        onOpenChange={(open) => !open && setSelectedDriverForCnh(null)}
      >
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <IdCard className="text-primary h-5 w-5" />
              Documento de Habilitação — CNH
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Comprovante de identificação e habilitação do motorista credenciado.
            </DialogDescription>
          </DialogHeader>

          {selectedDriverForCnh && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-muted/30 border border-border/70">
                <div className="h-12 w-12 rounded-xl overflow-hidden border border-border bg-card shrink-0 flex items-center justify-center">
                  {activeDriverCnhProfile?.foto ? (
                    <img
                      src={activeDriverCnhProfile.foto}
                      alt={selectedDriverForCnh.nome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-bold text-xs uppercase text-muted-foreground">
                      {selectedDriverForCnh.nome.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-foreground truncate">
                    {selectedDriverForCnh.nome}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono font-medium">CNH: {selectedDriverForCnh.cnh}</span>
                    {activeDriverCnhProfile?.cnhCategoria && (
                      <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold text-[10px]">
                        Cat. {activeDriverCnhProfile.cnhCategoria}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedDriverForCnh.ativo
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {selectedDriverForCnh.ativo ? "Regular" : "Inativo"}
                  </span>
                </div>
              </div>

              {/* Área da Imagem da CNH */}
              <div className="rounded-xl border border-border overflow-hidden bg-muted/20 min-h-48 flex items-center justify-center relative">
                {activeDriverCnhProfile?.cnhFoto ? (
                  <img
                    src={activeDriverCnhProfile.cnhFoto}
                    alt="Foto da CNH"
                    className="w-full max-h-72 object-contain bg-black/5"
                  />
                ) : (
                  <div className="p-8 text-center space-y-2">
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <p className="text-xs font-semibold text-foreground">
                      Foto da CNH não anexada
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-xs">
                      Clique em "Editar Foto/CNH" na lista de motoristas para carregar uma cópia da CNH digital ou física.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                {activeDriverCnhProfile?.cnhFoto && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs gap-1.5"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = activeDriverCnhProfile.cnhFoto!;
                      a.download = `CNH-${selectedDriverForCnh.nome.replace(/\s+/g, "_")}.jpg`;
                      a.click();
                    }}
                  >
                    <Download size={14} /> Baixar CNH
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs"
                  onClick={() => setSelectedDriverForCnh(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Atualizar Foto e CNH de Motorista Existente */}
      <Dialog
        open={Boolean(editingDriver)}
        onOpenChange={(open) => !open && setEditingDriver(null)}
      >
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Camera className="text-primary h-5 w-5" />
              Editar Foto & CNH do Motorista
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Atualize a foto de perfil e a via digital da CNH de {editingDriver?.nome}.
            </DialogDescription>
          </DialogHeader>

          {editingDriver && (
            <div className="space-y-4 pt-2">
              <input
                type="file"
                ref={editFotoInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileToDataUrl(file, setEditFoto);
                }}
              />
              <input
                type="file"
                ref={editCnhInputRef}
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileToDataUrl(file, setEditCnhFoto);
                }}
              />

              {/* Upload Foto */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Foto do Motorista</Label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="h-12 w-12 rounded-full overflow-hidden border border-border bg-card shrink-0 flex items-center justify-center">
                    {editFoto ? (
                      <img src={editFoto} alt="Foto" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {editFoto ? "Foto definida" : "Nenhuma foto selecionada"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">JPG, PNG ou WEBP</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1"
                    onClick={() => editFotoInputRef.current?.click()}
                  >
                    <Upload size={12} /> Alterar Foto
                  </Button>
                </div>
              </div>

              {/* Upload CNH */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Documento / Foto da CNH</Label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-border bg-card shrink-0 flex items-center justify-center">
                    {editCnhFoto ? (
                      <img src={editCnhFoto} alt="CNH" className="h-full w-full object-cover" />
                    ) : (
                      <IdCard className="h-6 w-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {editCnhFoto ? "Documento CNH anexado" : "Nenhuma CNH anexada"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Foto legível ou scan</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg gap-1"
                    onClick={() => editCnhInputRef.current?.click()}
                  >
                    <Upload size={12} /> Alterar CNH
                  </Button>
                </div>
              </div>

              {/* Categoria CNH */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria da CNH</Label>
                <div className="flex gap-1.5">
                  {CNH_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditCategoria(cat)}
                      className={`h-7 px-2.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                        editCategoria === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-xs"
                  onClick={() => setEditingDriver(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs"
                  onClick={handleSaveEditProfile}
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
