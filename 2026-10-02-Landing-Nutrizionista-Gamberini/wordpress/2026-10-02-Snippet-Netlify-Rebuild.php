<?php
/**
 * Rigenera il sito statico su Netlify quando un articolo viene
 * pubblicato, aggiornato, messo in bozza o cestinato.
 *
 * Installazione: plugin "Code Snippets" → Aggiungi nuovo → incolla da qui in giù
 * (senza la riga "<?php") → "Esegui ovunque" → Salva e attiva.
 *
 * Sostituire NETLIFY_BUILD_HOOK con l'URL generato in Netlify:
 * Site configuration → Build & deploy → Build hooks → Add build hook.
 */
const GAMBERINI_NETLIFY_HOOK = 'NETLIFY_BUILD_HOOK';

function gamberini_trigger_netlify( $reason ) {
	if ( strpos( GAMBERINI_NETLIFY_HOOK, 'https://api.netlify.com/build_hooks/' ) !== 0 ) {
		return; // hook non configurato
	}
	// Nessun blocco lato WordPress: Netlify mette in coda i build ravvicinati,
	// così anche una correzione salvata pochi secondi dopo finisce online.
	wp_remote_post(
		GAMBERINI_NETLIFY_HOOK . '?trigger_title=' . rawurlencode( 'WordPress: ' . $reason ),
		array( 'blocking' => false, 'timeout' => 5 )
	);
}

add_action( 'transition_post_status', function ( $new, $old, $post ) {
	if ( $post->post_type !== 'post' || wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
		return;
	}
	// Interessa solo se l'articolo è (o era) pubblico
	if ( $new === 'publish' || $old === 'publish' ) {
		gamberini_trigger_netlify( $new === 'publish' ? 'pubblicato/aggiornato "' . $post->post_title . '"' : 'rimosso "' . $post->post_title . '"' );
	}
}, 10, 3 );
