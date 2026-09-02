/*
 * Sidekick - diccionario unico, tres idiomas.
 *
 * Es un modulo, no un .json ni un .dic: leer un fichero con cep.fs dependia de
 * la ruta de la extension y de las constantes de codificacion, y fallaba en
 * silencio dejando el panel entero en ingles. Un import no puede fallar a
 * medias.
 *
 * La clave ES el texto en ingles, asi que anadir un idioma es copiar un bloque
 * y traducir los valores; lo que no este traducido sale en ingles.
 */
export const STRINGS = {
  en: {},
  es: {
    Copy: 'Copiar',
    Paste: 'Pegar',
    Copied: 'Copiado',
    Pasted: 'Pegado',
    'Paste on the top track': 'Pegar en la pista más alta',
    'Paste on top': 'Pegar encima',
    Language: 'Idioma',
    Refresh: 'Refrescar',
    'No project is open.': 'No hay ningún proyecto abierto.',
    'No active sequence.': 'No hay ninguna secuencia activa.',
    'Could not grab the frame. {0}': 'No he podido sacar el fotograma. {0}',
    'Save the project before pasting: the image needs a folder to live in.': 'Guarda el proyecto antes de pegar: la imagen necesita una carpeta donde vivir.',
    'Image not found: {0}': 'No encuentro la imagen: {0}',
    'Premiere refused to import the image.': 'Premiere rechazó importar la imagen.',
    'The image was imported but is missing from the bin.': 'La imagen se importó pero no aparece en el bin.',
    'No free video track at the playhead. The image is in the Sidekick bin.': 'No hay ninguna pista de vídeo libre en el cursor. La imagen está en el bin Sidekick.',
    'The {0} s gap is too short for the image and pasting would eat the next clip. The image is in the Sidekick bin.': 'El hueco de {0} s es demasiado corto y pegar se comería el clip siguiente. La imagen está en el bin Sidekick.',
    'Could not read the image file.': 'No he podido leer el fichero de la imagen.',
    'Could not write to the temporary folder.': 'No he podido escribir en la carpeta temporal.',
    'Could not reach the system clipboard.': 'No he podido acceder al portapapeles del sistema.',
    'Could not put the image in the clipboard.': 'No he podido poner la imagen en el portapapeles.',
    'Could not read the image from the clipboard.': 'No he podido leer la imagen del portapapeles.',
    'Could not save the frame to disk.': 'No he podido guardar el fotograma en disco.',
    'Premiere could not run the script. Try Refresh from the panel menu.': 'Premiere no ha podido ejecutar el script. Prueba Refrescar en el menú del panel.',
    'Premiere threw an error: {0}': 'Premiere ha dado un error: {0}',
    'Unknown host error.': 'Error desconocido en Premiere.',
  },
  pt: {
    Copy: 'Copiar',
    Paste: 'Colar',
    Copied: 'Copiado',
    Pasted: 'Colado',
    'Paste on the top track': 'Colar na trilha mais alta',
    'Paste on top': 'Colar por cima',
    Language: 'Idioma',
    Refresh: 'Atualizar',
    'No project is open.': 'Nenhum projeto aberto.',
    'No active sequence.': 'Nenhuma sequência ativa.',
    'Could not grab the frame. {0}': 'Não consegui capturar o frame. {0}',
    'Save the project before pasting: the image needs a folder to live in.': 'Salve o projeto antes de colar: a imagem precisa de uma pasta para morar.',
    'Image not found: {0}': 'Imagem não encontrada: {0}',
    'Premiere refused to import the image.': 'O Premiere recusou importar a imagem.',
    'The image was imported but is missing from the bin.': 'A imagem foi importada mas não aparece no bin.',
    'No free video track at the playhead. The image is in the Sidekick bin.': 'Nenhuma trilha de vídeo livre no cursor. A imagem está no bin Sidekick.',
    'The {0} s gap is too short for the image and pasting would eat the next clip. The image is in the Sidekick bin.': 'O espaço de {0} s é curto demais e colar engoliria o próximo clipe. A imagem está no bin Sidekick.',
    'Could not read the image file.': 'Não consegui ler o arquivo da imagem.',
    'Could not write to the temporary folder.': 'Não consegui escrever na pasta temporária.',
    'Could not reach the system clipboard.': 'Não consegui acessar a área de transferência do sistema.',
    'Could not put the image in the clipboard.': 'Não consegui colocar a imagem na área de transferência.',
    'Could not read the image from the clipboard.': 'Não consegui ler a imagem da área de transferência.',
    'Could not save the frame to disk.': 'Não consegui salvar o quadro no disco.',
    'Premiere could not run the script. Try Refresh from the panel menu.': 'O Premiere não conseguiu executar o script. Tente Atualizar no menu do painel.',
    'Premiere threw an error: {0}': 'O Premiere deu um erro: {0}',
    'Unknown host error.': 'Erro desconhecido no Premiere.',
  },
};
