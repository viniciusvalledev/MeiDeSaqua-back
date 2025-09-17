// src/utils/ProfanityFilter.ts

const PALAVRAS_PROIBIDAS: string[] = [
    "anal", "anus", "arrombada", "arrombado", "babaovo", "babaca", "bagos", "baitola", "bicha", "bixa",
    "boazuda", "boceta", "boiola", "bolagato", "boquete", "bosta", "brioco", "bronha", "buceta", "bunda",
    "bundao", "bundudo", "burra", "burro", "busseta", "cabaco", "cabrao", "cagar", "cagado", "cagao",
    "canalha", "caralho", "krl", "cacete", "kct", "corna", "corno", "cornudo", "chereca", "cherereca",
    "chifruda", "chifrudo", "chota", "chupa", "chupada", "chupado", "clitoris", "cocaina", "coco", "cu",
    "cuzinho", "cuzao", "desgraca", "drogado", "energumeno", "enfia", "estupida", "estupidez", "estupido",
    "estupro", "fiofo", "foda", "fodendo", "foder", "fodase", "fodeu", "fodida", "fodido", "fornicar",
    "fudendo", "fuder", "fudida", "fudido", "furo", "furona", "furnicar", "gaiato", "gay", "gonorreia",
    "grelinho", "grelo", "gozada", "gozado", "gozar", "herege", "idiota", "idiotice", "imbecil", "iscroto",
    "ladrao", "lambe", "lesbica", "macaca", "macaco", "maconha", "masturba", "masturbacao", "merda",
    "merdinha", "mija", "mijada", "mijado", "mijo", "mocreia", "mongol", "nadegas", "paspalhao", "peido",
    "pemba", "penis", "pentelha", "pentelho", "perereca", "peru", "pica", "picao", "pila", "pinto",
    "pintudo", "piranha", "piroca", "piru", "porno", "porra", "prega", "prostituta", "prostituto", "punheta",
    "punheteiro", "pustula", "puta", "puto", "puxasaco", "pqp", "putaquepariu", "rabo", "rabudo", "rabuda",
    "racha", "retardada", "retardado", "rola", "rosca", "sapatao", "siririca", "tarada", "tarado", "testuda",
    "tesuda", "tezuda", "transar", "trocha", "troucha", "trouxa", "troxa", "trolha", "vaca", "vadia",
    "vagabunda", "vagabundo", "vagina", "veada", "veado", "viada", "viado", "xana", "xaninha", "xavasca",
    "xereca", "xexeca", "xochota", "xota", "xoxota", "fdp", "filadaputa", "vsf", "vaisifoder", "tnc",
    "tomarnocu", "otario", "otaria", "cretino", "cretina", "vigarista", "pilantra", "escroto", "escrota",
    "ridiculo", "ridicula", "nojento", "nojenta", "lixo", "verme"
];

class ProfanityFilter {
    private normalizarTexto(input: string | null | undefined): string {
        if (!input) return "";
        return input.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    }

    public contemPalavrao(texto: string): boolean {
        if (!texto || texto.trim() === "") {
            return false;
        }
        const textoNormalizado = this.normalizarTexto(texto);
        return PALAVRAS_PROIBIDAS.some(palavra => textoNormalizado.includes(palavra));
    }
}

export default new ProfanityFilter();