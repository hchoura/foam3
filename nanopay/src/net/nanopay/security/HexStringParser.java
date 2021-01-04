package net.nanopay.security;

import foam.lib.json.NullParser;
import foam.lib.json.StringParser;
import foam.lib.parse.Alt;
import foam.lib.parse.PStream;
import foam.lib.parse.ParserContext;
import foam.lib.parse.ProxyParser;
import foam.util.SecurityUtil;

public class HexStringParser
  extends ProxyParser
{
  public HexStringParser() {
    super(
      new Alt(
        NullParser.instance(),
        StringParser.instance()
    ));
  }

  @Override
  public PStream parse(PStream ps, ParserContext x) {
    ps = super.parse(ps, x);
    if ( ps == null ) {
      return null;
    }

    if ( ps.value() == null ) {
      return ps;
    }

    return ps.setValue(SecurityUtil.HexStringToByteArray((String) ps.value()));
  }
}