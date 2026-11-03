package io.github.coyotewolf.aoi.model;
import java.util.*;
public final class RegistryLookup {
 public record Entry(String kind,String id,String name){}
 public static List<Entry> search(RegistryQuery query,List<Entry> entries){String term=query.query().toLowerCase(Locale.ROOT),english=term.replace(' ','_');var eligible=entries.stream().filter(e->query.kind().equals("any")||e.kind().equals(query.kind())).distinct().toList();var exact=eligible.stream().filter(e->e.id().equalsIgnoreCase(term)||e.name().equalsIgnoreCase(term)).toList();if(!exact.isEmpty())return exact.stream().sorted(Comparator.comparing(Entry::id).thenComparing(Entry::kind)).toList();return eligible.stream().filter(e->e.name().toLowerCase(Locale.ROOT).contains(term)||e.id().toLowerCase(Locale.ROOT).contains(english)).sorted(Comparator.comparing(Entry::id).thenComparing(Entry::kind)).toList();}
 private RegistryLookup(){}
}
