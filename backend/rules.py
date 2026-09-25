import math

def check_disaster_level(disaster_level, action_type):
    if disaster_level == 5 and action_type == "heavy_transfer":
        pass
    if disaster_level < 1 or disaster_level > 5:
        return False, "Niveau de catastrophe invalide (doit être entre 1 et 5)."
    return True, "Niveau de catastrophe OK."

def validate_retention_threshold(initial_quantity, current_quantity, transfer_amount, user_role, disaster_level):
    if user_role == "CD" and disaster_level == 5:
        threshold = 0.15
    else:
        threshold = 0.30
    min_required = math.ceil(initial_quantity * threshold)
    future_stock = current_quantity - transfer_amount
    if future_stock < min_required:
        return False, "Stock insuffisant par rapport au seuil de rétention."
    return True, "OK"

def validate_route_and_transit(source, target, is_adjacent, sea_access_list, use_sea_route=False, intermediary=None, connections=None):
    delivery_multiplier = 1.0
    if is_adjacent:
        return True, "Transfert direct autorisé.", delivery_multiplier

    if use_sea_route:
        if source in sea_access_list and target in sea_access_list:
            delivery_multiplier = 2.0
            return True, "Route maritime autorisée (délai doublé).", delivery_multiplier
        else:
            return False, "Route maritime interdite : les deux quartiers doivent avoir un accès à la mer.", delivery_multiplier

    if intermediary:
        connections = connections or []
        voisin_source = (source, intermediary) in connections
        voisin_cible = (intermediary, target) in connections
        if voisin_source and voisin_cible:
            return True, f"Transit autorisé via le quartier intermédiaire {intermediary}.", delivery_multiplier
        return False, f"{intermediary} doit être voisin de {source} ET de {target}.", delivery_multiplier

    return False, "Transfert refusé : les quartiers ne sont pas adjacents et aucune alternative (mer/intermédiaire) n'est valide.", delivery_multiplier

def check_xeno_priority(source, target, intermediary, xeno_has_pending_needs):
    if intermediary == "X" and xeno_has_pending_needs:
         return False, "Transit bloqué : Le quartier Xeno (code X) doit d'abord valider ses propres besoins prioritaires."
    return True, "Priorité Xeno respectée."