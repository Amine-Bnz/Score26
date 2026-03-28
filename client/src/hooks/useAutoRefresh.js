import { useState, useEffect, useRef } from 'react'

// Gère : polling silencieux toutes les `interval` ms + pull-to-refresh tactile
// onRefresh : fonction async appelée à chaque actualisation automatique
// Retourne : { lastUpdate, isPulling, touchHandlers, markUpdated }
// → appeler markUpdated() après le chargement initial pour initialiser le timestamp
export function useAutoRefresh(onRefresh, interval = 60_000) {
  const [lastUpdate, setLastUpdate] = useState(null)
  const [isPulling, setIsPulling] = useState(false)
  const cbRef        = useRef(onRefresh)
  const touchStartY  = useRef(null)
  const pulledEnough = useRef(false)

  // Toujours pointer vers la version la plus récente de onRefresh
  useEffect(() => { cbRef.current = onRefresh }, [onRefresh])

  function markUpdated() {
    setLastUpdate(Date.now())
  }

  async function actualiser() {
    await cbRef.current()
    markUpdated()
  }

  // Polling silencieux — pause quand le tab n'est pas visible (économie batterie/réseau)
  useEffect(() => {
    let id = setInterval(actualiser, interval)

    function onVisibility() {
      clearInterval(id)
      if (document.visibilityState === 'visible') {
        actualiser() // rafraîchir immédiatement au retour
        id = setInterval(actualiser, interval)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [interval])

  // Handlers tactiles pour pull-to-refresh
  const touchHandlers = {
    onTouchStart(e) {
      touchStartY.current = e.touches[0].clientY
      pulledEnough.current = false
    },
    onTouchMove(e) {
      if (touchStartY.current == null) return
      const delta = e.touches[0].clientY - touchStartY.current
      const enHaut = window.scrollY === 0
      if (delta > 65 && enHaut) {
        pulledEnough.current = true
        setIsPulling(true)
      } else {
        pulledEnough.current = false
        setIsPulling(false)
      }
    },
    onTouchEnd() {
      if (pulledEnough.current) actualiser()
      setIsPulling(false)
      touchStartY.current = null
      pulledEnough.current = false
    },
  }

  return { lastUpdate, isPulling, touchHandlers, markUpdated }
}
