// Modale Politique de confidentialité + CGU
// Accessible depuis le bas de la page Profil
// Obligatoire pour le Play Store et le RGPD

const CONTACT_EMAIL = 'contact@score26.fr' // TODO : remplacer par la vraie adresse

export default function LegalModal({ lang, onClose }) {
  const isFr = lang === 'fr'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-16 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col max-h-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">
            {isFr ? 'Politique de confidentialité' : 'Privacy Policy'}
          </h2>
          <button
            onClick={onClose}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition rounded-lg w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-sm flex-shrink-0"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">

          {isFr ? (
            <>
              <Section title="Qui sommes-nous ?">
                Score26 est une application de pronostics personnels pour la Coupe du Monde 2026.
                Elle est développée et exploitée à titre personnel. Pour toute question : <Email />.
              </Section>

              <Section title="Données collectées">
                Score26 collecte uniquement les données strictement nécessaires à son fonctionnement :
                <ul className="mt-2 flex flex-col gap-1.5 list-disc list-inside">
                  <li><strong>Pseudonyme</strong> : choisi librement par l'utilisateur lors de l'inscription. Aucun nom réel, aucune adresse e-mail.</li>
                  <li><strong>Pronostics</strong> : scores prédits pour chaque match.</li>
                  <li><strong>Identifiant technique</strong> : un UUID anonyme généré localement, stocké dans le navigateur (localStorage). Il ne permet pas d'identifier une personne réelle.</li>
                  <li><strong>Abonnement aux notifications push</strong> (optionnel) : si vous l'activez, un token de notification est transmis à notre serveur uniquement pour l'envoi de rappels avant les matchs.</li>
                </ul>
              </Section>

              <Section title="Utilisation des données">
                Les données sont utilisées exclusivement pour faire fonctionner l'application : afficher les pronostics, calculer les scores, envoyer les notifications si activées. Elles ne sont ni vendues, ni partagées avec des tiers, ni utilisées à des fins publicitaires.
              </Section>

              <Section title="Services tiers">
                Les avatars sont générés par <strong>DiceBear</strong> (dicebear.com) à partir du pseudonyme. Aucune autre donnée n'est transmise à des tiers.
              </Section>

              <Section title="Durée de conservation">
                Les données sont conservées tant que le compte est actif. La suppression des données du navigateur (vider le localStorage) équivaut à la suppression du compte côté client. Pour demander la suppression complète de vos données côté serveur, contactez-nous à <Email />.
              </Section>

              <Section title="Vos droits (RGPD)">
                Conformément au Règlement Général sur la Protection des Données, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits : <Email />.
              </Section>

              <Section title="Contact">
                <Email />
              </Section>
            </>
          ) : (
            <>
              <Section title="Who we are">
                Score26 is a personal prediction app for the 2026 FIFA World Cup, developed and operated independently. For any question: <Email />.
              </Section>

              <Section title="Data collected">
                Score26 only collects data strictly necessary for the app to work:
                <ul className="mt-2 flex flex-col gap-1.5 list-disc list-inside">
                  <li><strong>Username</strong>: freely chosen at sign-up. No real name, no email address.</li>
                  <li><strong>Predictions</strong>: predicted scores for each match.</li>
                  <li><strong>Technical identifier</strong>: an anonymous UUID generated locally and stored in the browser (localStorage). It does not identify a real person.</li>
                  <li><strong>Push notification subscription</strong> (optional): if enabled, a notification token is sent to our server solely to send pre-match reminders.</li>
                </ul>
              </Section>

              <Section title="Use of data">
                Data is used exclusively to run the app: displaying predictions, calculating scores, sending notifications if enabled. It is never sold, shared with third parties, or used for advertising.
              </Section>

              <Section title="Third-party services">
                Avatars are generated by <strong>DiceBear</strong> (dicebear.com) using the username. No other data is shared with third parties.
              </Section>

              <Section title="Data retention">
                Data is retained as long as the account is active. Clearing browser data (localStorage) removes the account on the client side. To request full server-side deletion, contact us at <Email />.
              </Section>

              <Section title="Your rights (GDPR)">
                Under the General Data Protection Regulation, you have the right to access, correct, and delete your data. To exercise these rights: <Email />.
              </Section>

              <Section title="Contact">
                <Email />
              </Section>
            </>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center pt-2">
            {isFr ? 'Dernière mise à jour : mars 2026' : 'Last updated: March 2026'}
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{title}</h3>
      <div>{children}</div>
    </div>
  )
}

function Email() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="text-blue-500 hover:underline"
    >
      {CONTACT_EMAIL}
    </a>
  )
}
