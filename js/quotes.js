/*
 * Sidekick - 77 witty movie quotes for IMAGE Copy & Paste.
 *
 * Actions  : "copy" (30) | "paste" (30) | "error" (17)
 * Languages: en | es (Latin American, a few Spain ones marked with esVariant) | pt (Brazil)
 * Platform : shortcuts are written as tokens and resolved on the fly
 *            {COPY} {PASTE} {MOD}  ->  Ctrl+C / Cmd+C  (uppercase: {COPY^} {PASTE^} {MOD^})
 *
 * Usage: getPhrase("copy", "es")            -> detects the platform itself
 *        getPhrase("copy", "es", { platform: "mac", symbols: true })  -> ⌘C
 */

// ───────────────────────── Shortcuts per platform ─────────────────────────

export const KEYMAPS = {
  win: { text: { MOD: "Ctrl", COPY: "Ctrl+C", PASTE: "Ctrl+V" },
         symbol: { MOD: "Ctrl", COPY: "Ctrl+C", PASTE: "Ctrl+V" } },
  mac: { text: { MOD: "Cmd", COPY: "Cmd+C", PASTE: "Cmd+V" },
         symbol: { MOD: "⌘", COPY: "⌘C", PASTE: "⌘V" } },
};

/** Detects mac/win. CEP has no require("os"): Premiere's CEF reports the
 * platform via navigator.platform ("MacIntel" / "Win32"). Defaults to win. */
export function detectPlatform() {
  const nav = globalThis.navigator;
  const id = (nav && (nav.userAgentData?.platform || nav.platform || nav.userAgent)) || "";
  return /mac|darwin|iphone|ipad/i.test(id) ? "mac" : "win";
}

/** Replaces {COPY}, {PASTE}, {MOD} and their uppercase variants {COPY^}. */
export function applyKeys(text, platform, symbols) {
  const map = (KEYMAPS[platform] || KEYMAPS.win)[symbols ? "symbol" : "text"];
  return text.replace(/\{(MOD|COPY|PASTE)(\^?)\}/g, (_, key, upper) =>
    upper ? map[key].toUpperCase() : map[key]
  );
}

// ───────────────────────────── The 77 quotes ─────────────────────────────

export const QUOTES = [
  // ══════════════ COPY — image copied to the clipboard (30) ══════════════
  { a: "copy", film: "Terminator", en: "I'll be back… and so will your image. Copied!", es: "Volveré… y tu imagen también. ¡Copiada!", pt: "Eu voltarei… e a sua imagem também. Copiada!" },
  { a: "copy", film: "Titanic", en: "Draw me like one of your French frames. Copied!", es: "Dibújame como a una de tus francesas. ¡Imagen copiada!", pt: "Me desenhe como uma de suas francesas. Imagem copiada!" },
  { a: "copy", film: "El Señor de los Anillos (Gollum)", en: "My precious pixels… copied.", es: "Mis pixeles precioosos… copiados.", pt: "Meus pixels precioosos… copiados." },
  { a: "copy", film: "Star Wars", en: "May the {COPY} be with you.", es: "Que la fuerza del {COPY} te acompañe.", pt: "Que a força do {COPY} esteja com você." },
  { a: "copy", film: "Toy Story (Buzz)", en: "To the clipboard… and beyond!", es: "¡Al clipboard y más allá!", pt: "Ao clipboard e além!" },
  { a: "copy", film: "Avatar", en: "I see you… and I copied you.", es: "Te veo… y te copié.", pt: "Eu vejo você… e copiei você." },
  { a: "copy", film: "El Padrino", en: "An image you can't refuse. Copied.", es: "Una imagen que no podrás rechazar. Copiada.", pt: "Uma imagem que você não pode recusar. Copiada." },
  { a: "copy", film: "James Bond", en: "Copied. Shot, not stirred.", es: "Copiada. Agitada, no revuelta.", pt: "Copiada. Batida, não mexida." },
  { a: "copy", film: "Spider-Man", en: "With great pixels comes great responsibility. Copied.", es: "Un gran pixelaje conlleva una gran responsabilidad. Copiada.", pt: "Com grandes pixels vêm grandes responsabilidades. Copiada." },
  { a: "copy", film: "La Sociedad de los Poetas Muertos", en: "Carpe imaginem. Seize the frame!", es: "Carpe imaginem: aprovecha el frame. ¡Copiado!", pt: "Carpe imaginem: aproveite o frame. Copiado!" },
  { a: "copy", film: "Blow-Up", en: "Blow it up. Copied.", es: "Amplíala. Imagen copiada.", pt: "Amplia essa. Imagem copiada." },
  { a: "copy", film: "Scarface", en: "Say hello to my little frame. Copied.", es: "Saluda a mi pequeño frame. Copiado.", pt: "Diga olá para o meu framezinho. Copiado." },
  { a: "copy", film: "Ratatouille", en: "Anyone can copy. Even this frame.", es: "Cualquiera puede copiar. Hasta este frame.", pt: "Qualquer um pode copiar. Até esse frame." },
  { a: "copy", film: "Coco", en: "Remember me… I'm in the clipboard now.", es: "Recuérdame… ya estoy en el clipboard.", pt: "Lembre de mim… já estou no clipboard." },
  { a: "copy", film: "Karate Kid", en: "{MOD} on, {MOD} off. Image copied.", es: "{MOD} pon, {MOD} quita. ¡Imagen copiada!", pt: "{MOD} põe, {MOD} tira. Imagem copiada!" },
  { a: "copy", film: "El Mago de Oz", en: "There's no place like the clipboard.", es: "No hay lugar como el clipboard.", pt: "Não há lugar como o clipboard." },
  { a: "copy", film: "Sherlock Holmes", en: "Elementary, my dear Watson: image copied.", es: "Elemental, mi querido Watson: imagen copiada.", pt: "Elementar, meu caro Watson: imagem copiada." },
  { a: "copy", film: "Top Gun", en: "I feel the need… the need for {COPY}!", es: "Siento la necesidad… ¡la necesidad de {COPY}!", pt: "Sinto a necessidade… a necessidade de {COPY}!" },
  { a: "copy", film: "Matrix", en: "You took the {COPY} pill. Image copied.", es: "Tomaste la pastilla del {COPY}. Imagen copiada.", pt: "Você tomou a pílula do {COPY}. Imagem copiada." },
  { a: "copy", film: "Harry Potter", en: "Copiardium Leviosa! Image in the clipboard.", es: "¡Copiardium Leviosa! Imagen en el clipboard.", pt: "Copiardium Leviosa! Imagem no clipboard." },
  { a: "copy", film: "El Rey León", en: "Everything the light touches… is copied.", es: "Todo lo que ilumina la luz… está copiado.", pt: "Tudo o que a luz toca… está copiado." },
  { a: "copy", film: "Blancanieves", en: "Mirror, mirror on the wall… who's the fairest frame of all? Copied.", es: "Espejito, espejito… ¿cuál es el frame más bonito? Copiado.", pt: "Espelho, espelho meu… qual o frame mais belo? Copiado." },
  { a: "copy", film: "El Club de la Pelea", en: "First rule of the clipboard: you always press {COPY}.", es: "Primera regla del clipboard: siempre se pulsa {COPY}.", pt: "Primeira regra do clipboard: sempre se aperta {COPY}." },
  { a: "copy", film: "Guardianes de la Galaxia", en: "I am… copied.", es: "Yo soy… copiado.", pt: "Eu sou… copiado." },
  { a: "copy", film: "Avengers", en: "Pixels, assemble! Image copied.", es: "¡Pixeles, reuníos! Imagen copiada.", pt: "Pixels, avante! Imagem copiada." },
  { a: "copy", film: "Taxi Driver", en: "You lookin' at me? Copied.", es: "¿Me estás mirando a mí? Copiada.", pt: "Você está olhando para mim? Copiada." },
  { a: "copy", film: "Gladiador", esVariant: "españa", en: "Are you not entertained? Image copied!", es: "¿No os divertís? ¡Imagen copiada!", pt: "Não estão se divertindo? Imagem copiada!" },
  { a: "copy", film: "Casablanca", en: "We'll always have this frame.", es: "Siempre nos quedará este frame.", pt: "Sempre teremos esse frame." },
  { a: "copy", film: "El Show de Truman", en: "In case I don't see you: copied, good afternoon and good night!", es: "Por si no te veo: ¡copiada, buenas tardes y buenas noches!", pt: "Caso eu não te veja: copiada, boa tarde e boa noite!" },
  { a: "copy", film: "Cinema Paradiso", en: "Every frame worth keeping. Copied.", es: "Cada frame que vale la pena guardar. Copiado.", pt: "Cada frame que vale a pena guardar. Copiado." },

  // ══════════════ PASTE — image pasted from the clipboard (30) ══════════════
  { a: "paste", film: "Terminator 2", esVariant: "españa", en: "Hasta la vista, clipboard. Image pasted!", es: "Sayonara, clipboard. ¡Imagen pegada!", pt: "Hasta la vista, clipboard. Imagem colada!" },
  { a: "paste", film: "El Resplandor", en: "Heeere's your image!", es: "¡Aquí está tu imagen!", pt: "Olha a sua imagem aquiii!" },
  { a: "paste", film: "Forrest Gump", en: "Run, Forrest… it's already pasted.", es: "Corre, Forrest… ya está pegada.", pt: "Corre, Forrest… já está colada." },
  { a: "paste", film: "Star Wars (Vader)", en: "Image… I am your clipboard. Pasted.", es: "Imagen… yo soy tu portapapeles. Pegada.", pt: "Imagem… eu sou o seu clipboard. Colada." },
  { a: "paste", film: "300", en: "THIS. IS. {PASTE^}!", es: "¡ESTO. ES. {PASTE^}!", pt: "ISSO. É. {PASTE^}!" },
  { a: "paste", film: "Frozen", en: "Let it go… the image is pasted.", es: "Libre soy… y la imagen ya está pegada.", pt: "Livre estou… e a imagem já está colada." },
  { a: "paste", film: "Braveheart", en: "FREEDOM! Your image is pasted.", es: "¡LIBERTAD! Tu imagen ya está pegada.", pt: "LIBERDADE! Sua imagem já está colada." },
  { a: "paste", film: "Volver al Futuro", en: "Roads? Where we paste, we don't need roads.", es: "¿Caminos? A donde pegamos no necesitamos caminos.", pt: "Estradas? Onde a gente cola não precisa de estradas." },
  { a: "paste", film: "Jurassic Park", en: "The image finds a way. Pasted.", es: "La imagen se abre camino. Pegada.", pt: "A imagem encontra um meio. Colada." },
  { a: "paste", film: "Casablanca", en: "Paste it again, Sam.", es: "Pégala otra vez, Sam.", pt: "Cola de novo, Sam." },
  { a: "paste", film: "Rocky", en: "Adriaaan! I pasted it!", es: "¡Adriaaana! ¡La pegué!", pt: "Adriaaana! Eu colei!" },
  { a: "paste", film: "Aladdín", en: "A whole new world… with your image pasted.", es: "Un mundo ideal… con tu imagen pegada.", pt: "Um mundo ideal… com sua imagem colada." },
  { a: "paste", film: "Madagascar", en: "I like to move it… I mean, {PASTE} it! Pasted.", es: "Me gusta moverlo… digo, ¡{PASTE}! Imagen pegada.", pt: "Eu gosto de mexer… quer dizer, {PASTE}! Imagem colada." },
  { a: "paste", film: "Shrek", en: "Layers. Images have layers. Pasted.", es: "Capas. Las imágenes tienen capas. Pegada.", pt: "Camadas. As imagens têm camadas. Colada." },
  { a: "paste", film: "Monsters Inc.", en: "That image came from the clipboard… and now it's pasted.", es: "Esa imagen salió del clipboard… y ya está pegada.", pt: "Essa imagem saiu do clipboard… e já está colada." },
  { a: "paste", film: "E.T.", en: "E.T. image… home. Pasted!", es: "E.T. imagen… casa. ¡Pegada!", pt: "E.T. imagem… casa. Colada!" },
  { a: "paste", film: "El Reportero (Anchorman)", en: "This image is kind of a big deal. Pasted.", es: "Esta imagen es todo un personaje. Pegada.", pt: "Essa imagem é meio que importante. Colada." },
  { a: "paste", film: "Notting Hill", en: "Just an image, standing in front of a timeline, asking to be pasted.", es: "Solo una imagen frente a un timeline, pidiendo ser pegada.", pt: "Só uma imagem na frente de uma timeline, pedindo para ser colada." },
  { a: "paste", film: "Harry Potter", en: "Expecto Pastonum! Image pasted.", es: "¡Expecto Pegatum! Imagen pegada.", pt: "Expecto Colatum! Imagem colada." },
  { a: "paste", film: "Los Juegos del Hambre", en: "May the pixels be ever in your favor. Pasted.", es: "Que los pixeles estén siempre de tu parte. Pegada.", pt: "Que os pixels estejam sempre a seu favor. Colada." },
  { a: "paste", film: "Toy Story (Woody)", en: "You've got a friend in the clipboard. Pasted!", es: "Tienes un amigo en el clipboard. ¡Pegada!", pt: "Você tem um amigo no clipboard. Colada!" },
  { a: "paste", film: "Kung Fu Panda", en: "There is no secret ingredient. Just {PASTE}.", es: "No hay ingrediente secreto: solo {PASTE}.", pt: "Não existe ingrediente secreto: só {PASTE}." },
  { a: "paste", film: "WALL·E", en: "Eeeva! Image pasted.", es: "¡Eeeva! Imagen pegada.", pt: "Eeeva! Imagem colada." },
  { a: "paste", film: "Up", en: "Adventure is out there… and now it's in your timeline. Pasted.", es: "La aventura está allá afuera… y ahora en tu timeline. Pegada.", pt: "A aventura está lá fora… e agora na sua timeline. Colada." },
  { a: "paste", film: "Pulp Fiction", en: "One royale with cheese, pasted.", es: "Un royale con queso, pegado.", pt: "Um royale com queijo, colado." },
  { a: "paste", film: "Lo que el viento se llevó", en: "As God is my witness: pasted!", es: "A Dios pongo por testigo: ¡pegada!", pt: "Ponho Deus por testemunha: colada!" },
  { a: "paste", film: "Batman (Joker)", en: "Why so serious? It's already pasted.", es: "¿Por qué tan serio? Ya está pegada.", pt: "Por que tão sério? Já está colada." },
  { a: "paste", film: "Dirty Dancing", en: "Nobody puts this image in a corner. Pasted.", es: "Nadie deja esta imagen en un rincón. Pegada.", pt: "Ninguém deixa essa imagem num canto. Colada." },
  { a: "paste", film: "Los Cazafantasmas", en: "Who you gonna call? {PASTE^}!", es: "¿A quién vas a llamar? ¡{PASTE^}!", pt: "Para quem você vai ligar? {PASTE^}!" },
  { a: "paste", film: "Buscando a Nemo (Dory)", en: "Just keep pasting, just keep pasting…", es: "Sigue pegando, sigue pegando… ¡Imagen pegada!", pt: "Continue a colar, continue a colar… Imagem colada!" },

  // ══════════════ ERROR — no valid image in the clipboard (17) ══════════════
  { a: "error", film: "Apolo 13", en: "Houston, we have a problem: no image in the clipboard.", es: "Houston, tenemos un problema: no hay imagen en el clipboard.", pt: "Houston, temos um problema: não há imagem no clipboard." },
  { a: "error", film: "El Señor de los Anillos (Gandalf)", en: "YOU SHALL NOT {PASTE^}! No valid image in the clipboard.", es: "¡NO PEGARÁS! De nada sirve tu {PASTE}: no hay imagen válida.", pt: "VOCÊ NÃO VAI COLAR! De nada adianta o {PASTE}: não há imagem válida." },
  { a: "error", film: "Star Wars (Obi-Wan)", en: "This is not the image you're looking for.", es: "Esta no es la imagen que buscas.", pt: "Esta não é a imagem que você procura." },
  { a: "error", film: "Matrix", en: "There is no spoon… and no image in the clipboard.", es: "No hay cuchara… ni imagen en el clipboard.", pt: "Não existe colher… nem imagem no clipboard." },
  { a: "error", film: "Sexto Sentido", en: "I see empty clipboards.", es: "Veo clipboards vacíos.", pt: "Eu vejo clipboards vazios." },
  { a: "error", film: "Tiburón", en: "We're gonna need a bigger clipboard… this one has no image.", es: "Vamos a necesitar un clipboard más grande… este no tiene imagen.", pt: "Vamos precisar de um clipboard maior… este não tem imagem." },
  { a: "error", film: "Star Wars (Yoda)", en: "{PASTE} or {PASTE} not… but image here, there is none.", es: "{PASTE} o no {PASTE}… pero imagen aquí, no hay.", pt: "{PASTE} ou não {PASTE}… mas imagem aqui, não há." },
  { a: "error", film: "Chicas Pesadas", en: "Stop trying to make it happen. There's no image to paste.", es: "Deja de intentarlo: no hay imagen para pegar.", pt: "Para de tentar: não tem imagem para colar." },
  { a: "error", film: "Clueless", en: "As if! There's no image here.", es: "¡Como si hubiera una imagen aquí!", pt: "Até parece! Não tem imagem aqui." },
  { a: "error", film: "Los Increíbles", en: "Where's my super image?! Not in the clipboard.", es: "¡¿Dónde está mi superimagen?! No está en el clipboard.", pt: "Cadê a minha superimagem?! Não está no clipboard." },
  { a: "error", film: "Toy Story (Woody)", en: "There's a snake in my boot… and no image in the clipboard!", es: "¡Hay una víbora en mi bota… y ninguna imagen en el clipboard!", pt: "Tem uma cobra na minha bota… e nenhuma imagem no clipboard!" },
  { a: "error", film: "Gremlins", en: "Don't feed the clipboard after midnight. There's no image anyway.", es: "No alimentes el clipboard después de medianoche… igual no hay imagen.", pt: "Não alimente o clipboard depois da meia-noite… não tem imagem mesmo." },
  { a: "error", film: "El Mago de Oz", en: "Toto, I've a feeling there's no image here.", es: "Toto, presiento que aquí no hay ninguna imagen.", pt: "Totó, tenho a impressão de que aqui não há imagem." },
  { a: "error", film: "Lo que el viento se llevó", en: "Frankly, my dear, the clipboard has no image.", es: "Francamente, querido, el clipboard no tiene ninguna imagen.", pt: "Francamente, meu caro, o clipboard não tem imagem alguma." },
  { a: "error", film: "Mi Pobre Angelito", en: "KEVIIIN! Where's the image?!", es: "¡¿KEVIIIN?! ¡¿Dónde está la imagen?!", pt: "KEVIIIN! Cadê a imagem?!" },
  { a: "error", film: "Buscando a Nemo (Dory)", en: "I suffer from short-term memory loss… no image in the clipboard.", es: "Sufro pérdida de memoria a corto plazo… no hay imagen en el clipboard.", pt: "Eu tenho perda de memória recente… não há imagem no clipboard." },
  { a: "error", film: "Los Simpson (Homero)", en: "D'oh! You pressed {COPY} on nothing.", es: "¡D'oh! Le diste al {COPY} sin nada seleccionado.", pt: "D'oh! Você apertou {COPY} sem nada selecionado." },
];

// ───────────────────────────── Public API ─────────────────────────────

/**
 * Returns a random quote already resolved for the platform.
 * @param {"copy"|"paste"|"error"} action
 * @param {"en"|"es"|"pt"} lang
 * @param {{ platform?: "mac"|"win", symbols?: boolean }} [opts]
 *        platform: detected automatically when omitted.
 *        symbols : true -> ⌘C / ⌘V on Mac; false (default) -> Cmd+C / Cmd+V.
 * @returns {{ text: string, film: string, platform: string }}
 */
export function getPhrase(action, lang = "es", opts = {}) {
  const platform = opts.platform || detectPlatform();
  const symbols = opts.symbols === true;
  const pool = QUOTES.filter(q => q.a === action);
  const q = pool[Math.floor(Math.random() * pool.length)];
  return {
    text: applyKeys(q[lang] || q.es, platform, symbols),
    film: q.film,
    platform,
  };
}
