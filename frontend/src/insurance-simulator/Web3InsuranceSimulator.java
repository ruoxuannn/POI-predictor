import javax.swing.*;
import javax.swing.event.ChangeListener;
import javax.swing.table.DefaultTableModel;
import javax.swing.table.DefaultTableCellRenderer;
import java.awt.*;
import java.awt.event.*;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;

public class Web3InsuranceSimulator extends JFrame {

    private static final double LONDON_CRIME = 65.0;
    private static final double LONDON_DENSITY = 100.0;
    private static final double MARKET_PRICE = 4.5;
    private static final double POOL_DEFAULT = 500000;

    private String pubName = "My Pub";
    private double inputArea = 250;
    private int inputEmployees = 10;
    private double inputRevenue = 500000;
    private double inputRent = 40000;
    private double inputRating = 4.0;
    private double inputPrice = 4.5;
    private int inputHours = 12;
    private int inputLateHours = 0;

    private double currentRating, currentPrice, currentArea;
    private int currentHours, currentLateHours, currentEmployees;

    private double prizePool = POOL_DEFAULT;
    private double totalPayouts = 0;
    private static final double TH1 = 0.90, TH2 = 0.80, TH3 = 0.70;

    private double baseRevFinal, baseIns;
    private List<PubData> pubList = new ArrayList<PubData>();
    private int curPubIdx = -1;

    private JSlider ratingS, priceS, hoursS, lateS, areaS, empS;
    private JLabel ratingV, priceV, hoursV, lateV, areaV, empV;
    private JLabel yieldL, revResultL, riskL, insL, poolL, payoutL, statusL, pubNameL;
    private JTextArea yieldF, revF, riskF, insF;
    private JPanel mainP;
    private CardLayout cards;
    private DecimalFormat df = new DecimalFormat("#,##0");
    private DecimalFormat pf = new DecimalFormat("0.00");

    public Web3InsuranceSimulator() {
        super("Web3 Pub Insurance - Real Data");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1750, 1000);
        setLocationRelativeTo(null);
        cards = new CardLayout();
        mainP = new JPanel(cards);
        mainP.add(buildDataEntry(), "ENTRY");
        mainP.add(new JPanel(), "SIM");
        setContentPane(mainP);
        cards.show(mainP, "ENTRY");
    }

    static class ColorButton extends JButton {
        private Color bgColor, hoverColor;
        ColorButton(String text, Color bg) {
            super(text);
            this.bgColor = bg;
            this.hoverColor = bg.brighter();
            setFont(new Font("Arial", Font.BOLD, 13));
            setForeground(Color.WHITE);
            setFocusPainted(false);
            setBorderPainted(false);
            setContentAreaFilled(false);
            setOpaque(false);
            setCursor(new Cursor(Cursor.HAND_CURSOR));
            setPreferredSize(new Dimension(getPreferredSize().width + 32, 38));
            addMouseListener(new MouseAdapter() {
                public void mouseEntered(MouseEvent e) { repaint(); }
                public void mouseExited(MouseEvent e) { repaint(); }
            });
        }
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            Color c = getModel().isRollover() ? hoverColor : bgColor;
            if (getModel().isPressed()) c = bgColor.darker();
            g2.setColor(c);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), 8, 8);
            g2.dispose();
            super.paintComponent(g);
        }
    }

    private JButton btn(String text, Color bg) { return new ColorButton(text, bg); }

    // ==================== DATA ENTRY ====================
    private JPanel buildDataEntry() {
        JPanel outer = new JPanel(new BorderLayout());
        outer.setBackground(Color.WHITE);

        JPanel tb = new JPanel();
        tb.setBackground(new Color(44, 62, 80));
        tb.setPreferredSize(new Dimension(1750, 75));
        tb.setLayout(new BoxLayout(tb, BoxLayout.Y_AXIS));
        tb.setBorder(BorderFactory.createEmptyBorder(14, 0, 14, 0));
        JLabel t1 = new JLabel("Web3 Pub Insurance - Data Input");
        t1.setFont(new Font("Arial", Font.BOLD, 26)); t1.setForeground(Color.WHITE);
        t1.setAlignmentX(Component.CENTER_ALIGNMENT);
        JLabel t2 = new JLabel("Enter your scraped pub data, then launch simulator");
        t2.setFont(new Font("Arial", Font.PLAIN, 13)); t2.setForeground(new Color(189,195,199));
        t2.setAlignmentX(Component.CENTER_ALIGNMENT);
        tb.add(t1); tb.add(Box.createVerticalStrut(4)); tb.add(t2);
        outer.add(tb, BorderLayout.NORTH);

        JPanel center = new JPanel(new BorderLayout(20, 20));
        center.setBackground(Color.WHITE);
        center.setBorder(BorderFactory.createEmptyBorder(20, 30, 20, 30));

        JPanel form = new JPanel();
        form.setLayout(new BoxLayout(form, BoxLayout.Y_AXIS));
        form.setBackground(Color.WHITE);
        form.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createTitledBorder(BorderFactory.createLineBorder(new Color(52,152,219), 2),
                " Enter Pub Data ", javax.swing.border.TitledBorder.LEFT,
                javax.swing.border.TitledBorder.TOP, new Font("Arial", Font.BOLD, 14), new Color(52,152,219)),
            BorderFactory.createEmptyBorder(12, 15, 12, 15)));
        form.setPreferredSize(new Dimension(480, 680));

        JTextField nf=new JTextField("The Red Lion"), af=new JTextField("250"),
            ef=new JTextField("10"), rf=new JTextField("500000"),
            rnf=new JTextField("40000"), rtf=new JTextField("4.0"),
            prf=new JTextField("4.50"), hf=new JTextField("12"), lf=new JTextField("0");

        String[][] flds = {
            {"Pub Name","e.g. The Red Lion"}, {"Floor Area (sq m)","e.g. 250"},
            {"Employees","e.g. 10"}, {"Annual Revenue (GBP)","e.g. 500000"},
            {"Annual Rent (GBP)","e.g. 40000"}, {"Star Rating (1.0-5.0)","from Google/TripAdvisor"},
            {"Avg Pint Price (GBP)","e.g. 4.50"}, {"Daily Hours (8-24)","e.g. 12 = 11am-11pm"},
            {"Late Night Hrs (0-5)","hrs after 11pm, max=5 for 4am"}
        };
        JTextField[] fc = {nf, af, ef, rf, rnf, rtf, prf, hf, lf};

        for (int i = 0; i < flds.length; i++) {
            JPanel row = new JPanel(new BorderLayout(10, 0));
            row.setBackground(Color.WHITE);
            row.setMaximumSize(new Dimension(450, 50));
            JPanel lp = new JPanel(); lp.setLayout(new BoxLayout(lp, BoxLayout.Y_AXIS));
            lp.setBackground(Color.WHITE); lp.setPreferredSize(new Dimension(200, 46));
            JLabel lb = new JLabel(flds[i][0]); lb.setFont(new Font("Arial", Font.BOLD, 12));
            JLabel ht = new JLabel(flds[i][1]); ht.setFont(new Font("Arial", Font.ITALIC, 9));
            ht.setForeground(Color.GRAY); lp.add(lb); lp.add(ht);
            fc[i].setFont(new Font("Arial", Font.PLAIN, 14));
            fc[i].setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(200,200,200)),
                BorderFactory.createEmptyBorder(4, 8, 4, 8)));
            row.add(lp, BorderLayout.WEST); row.add(fc[i], BorderLayout.CENTER);
            form.add(row); form.add(Box.createVerticalStrut(4));
        }

        JPanel bp = new JPanel(new FlowLayout(FlowLayout.CENTER, 10, 6));
        bp.setBackground(Color.WHITE); bp.setMaximumSize(new Dimension(460, 55));
        JButton addB = btn("Add to List", new Color(46,204,113));
        JButton launchB = btn("Launch Simulator >>", new Color(52,152,219));
        JButton clearB = btn("Clear All", new Color(231,76,60));
        bp.add(addB); bp.add(launchB); bp.add(clearB);
        form.add(Box.createVerticalStrut(8)); form.add(bp);

        String[] cols = {"Name","Area","Emp","Revenue","Rent","Rating","Price","Hrs","Late"};
        DefaultTableModel tm = new DefaultTableModel(cols, 0) {
            public boolean isCellEditable(int r, int c) { return false; }
        };
        JTable tbl = new JTable(tm);
        tbl.setFont(new Font("Arial", Font.PLAIN, 12)); tbl.setRowHeight(28);
        tbl.getTableHeader().setFont(new Font("Arial", Font.BOLD, 11));
        tbl.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        tbl.setGridColor(new Color(220,220,220));
        DefaultTableCellRenderer rrr = new DefaultTableCellRenderer();
        rrr.setHorizontalAlignment(JLabel.RIGHT);
        for (int i = 1; i < cols.length; i++) tbl.getColumnModel().getColumn(i).setCellRenderer(rrr);

        JPanel ip = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 5));
        ip.setBackground(Color.WHITE);
        JButton csvB = btn("Import CSV", new Color(155,89,182));
        csvB.setFont(new Font("Arial", Font.BOLD, 12));
        JLabel ch = new JLabel("CSV: name,area,employees,revenue,rent,rating,price,hours,lateHours");
        ch.setFont(new Font("Arial", Font.ITALIC, 10)); ch.setForeground(Color.GRAY);
        ip.add(csvB); ip.add(ch);

        JPanel rp = new JPanel(new BorderLayout(0, 8));
        rp.setBackground(Color.WHITE);
        rp.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createTitledBorder(BorderFactory.createLineBorder(new Color(46,204,113), 2),
                " Pub Database (click row, then Launch) ", javax.swing.border.TitledBorder.LEFT,
                javax.swing.border.TitledBorder.TOP, new Font("Arial", Font.BOLD, 14), new Color(46,204,113)),
            BorderFactory.createEmptyBorder(8, 10, 10, 10)));
        rp.add(ip, BorderLayout.NORTH); rp.add(new JScrollPane(tbl), BorderLayout.CENTER);

        center.add(form, BorderLayout.WEST); center.add(rp, BorderLayout.CENTER);
        outer.add(center, BorderLayout.CENTER);

        JPanel bot = new JPanel(); bot.setBackground(new Color(236,240,241));
        bot.setBorder(BorderFactory.createEmptyBorder(10, 20, 10, 20));
        JLabel il = new JLabel("<html><b>Steps:</b> (1) Enter data -> (2) <font color='#2ecc71'>Add to List</font> -> (3) Select row -> (4) <font color='#3498db'>Launch Simulator</font>  |  Prize Pool fixed at GBP 500,000</html>");
        il.setFont(new Font("Arial", Font.PLAIN, 13)); bot.add(il);
        outer.add(bot, BorderLayout.SOUTH);

        addB.addActionListener(e -> {
            try {
                PubData pd = new PubData();
                pd.name = nf.getText().trim();
                if (pd.name.isEmpty()) { err("Name empty"); return; }
                pd.area = Double.parseDouble(af.getText().trim());
                pd.employees = Integer.parseInt(ef.getText().trim());
                pd.revenue = Double.parseDouble(rf.getText().trim());
                pd.rent = Double.parseDouble(rnf.getText().trim());
                pd.rating = Double.parseDouble(rtf.getText().trim());
                pd.price = Double.parseDouble(prf.getText().trim());
                pd.hours = Integer.parseInt(hf.getText().trim());
                pd.lateHours = Integer.parseInt(lf.getText().trim());
                if (pd.rating<1||pd.rating>5) { err("Rating 1.0-5.0"); return; }
                if (pd.hours<8||pd.hours>24) { err("Hours 8-24"); return; }
                if (pd.lateHours<0||pd.lateHours>5) { err("Late 0-5"); return; }
                pubList.add(pd);
                tm.addRow(new Object[]{pd.name, df.format(pd.area), pd.employees,
                    "GBP "+df.format(pd.revenue), "GBP "+df.format(pd.rent),
                    pf.format(pd.rating), "GBP "+pf.format(pd.price), pd.hours, pd.lateHours});
                tbl.setRowSelectionInterval(tm.getRowCount()-1, tm.getRowCount()-1);
                JOptionPane.showMessageDialog(this, "\""+pd.name+"\" added! Total: "+pubList.size());
            } catch (NumberFormatException ex) { err("Bad number format"); }
        });
        launchB.addActionListener(e -> {
            if (pubList.isEmpty()) { err("Add a pub first!"); return; }
            int s = tbl.getSelectedRow(); if (s < 0) s = 0;
            curPubIdx = s; loadPub(pubList.get(s)); launchSim();
        });
        clearB.addActionListener(e -> { pubList.clear(); tm.setRowCount(0); });
        csvB.addActionListener(e -> {
            JFileChooser ch2 = new JFileChooser();
            ch2.setFileFilter(new javax.swing.filechooser.FileNameExtensionFilter("CSV", "csv"));
            if (ch2.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
                try {
                    java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(ch2.getSelectedFile()));
                    String ln; boolean hdr = true; int cnt = 0;
                    while ((ln = br.readLine()) != null) {
                        if (hdr) { hdr = false; continue; }
                        String[] p = ln.split(",");
                        if (p.length >= 9) {
                            PubData pd = new PubData();
                            pd.name = p[0].trim().replace("\"","");
                            pd.area = Double.parseDouble(p[1].trim());
                            pd.employees = Integer.parseInt(p[2].trim());
                            pd.revenue = Double.parseDouble(p[3].trim());
                            pd.rent = Double.parseDouble(p[4].trim());
                            pd.rating = Double.parseDouble(p[5].trim());
                            pd.price = Double.parseDouble(p[6].trim());
                            pd.hours = Integer.parseInt(p[7].trim());
                            pd.lateHours = Integer.parseInt(p[8].trim());
                            pubList.add(pd);
                            tm.addRow(new Object[]{pd.name, df.format(pd.area), pd.employees,
                                "GBP "+df.format(pd.revenue), "GBP "+df.format(pd.rent),
                                pf.format(pd.rating), "GBP "+pf.format(pd.price), pd.hours, pd.lateHours});
                            cnt++;
                        }
                    }
                    br.close();
                    JOptionPane.showMessageDialog(this, "Imported "+cnt+" pubs!");
                } catch (Exception ex) { err("CSV error: "+ex.getMessage()); }
            }
        });
        return outer;
    }

    private void err(String m) { JOptionPane.showMessageDialog(this, m, "Error", JOptionPane.ERROR_MESSAGE); }

    private void loadPub(PubData pd) {
        pubName=pd.name; inputArea=pd.area; inputEmployees=pd.employees;
        inputRevenue=pd.revenue; inputRent=pd.rent; inputRating=pd.rating;
        inputPrice=pd.price; inputHours=pd.hours; inputLateHours=pd.lateHours;
        prizePool=POOL_DEFAULT; totalPayouts=0;
        currentRating=inputRating; currentPrice=inputPrice; currentHours=inputHours;
        currentLateHours=inputLateHours; currentArea=inputArea; currentEmployees=inputEmployees;
        PubMetrics b = calc(inputRating, inputPrice, inputHours, inputLateHours, inputArea, inputEmployees, inputRevenue, inputRent);
        baseRevFinal=b.rev; baseIns=b.ins;
    }

    private void launchSim() {
        for (Component c : mainP.getComponents()) if ("SIM".equals(c.getName())) { mainP.remove(c); break; }
        JPanel s = buildSim(); s.setName("SIM");
        mainP.add(s, "SIM"); cards.show(mainP, "SIM"); doUpdate();
    }

    // ==================== SIMULATOR ====================
    private JPanel buildSim() {
        JPanel p = new JPanel(new BorderLayout(8, 8));
        p.setBackground(Color.WHITE); p.setName("SIM");

        JPanel top = new JPanel(new BorderLayout());
        top.setBackground(new Color(26,188,156));
        top.setPreferredSize(new Dimension(1750, 60));
        top.setBorder(BorderFactory.createEmptyBorder(8, 20, 8, 20));
        JPanel tl = new JPanel(); tl.setOpaque(false);
        tl.setLayout(new BoxLayout(tl, BoxLayout.Y_AXIS));
        pubNameL = new JLabel("Pub: " + pubName);
        pubNameL.setFont(new Font("Arial", Font.BOLD, 22)); pubNameL.setForeground(Color.WHITE);
        JLabel sub = new JLabel("Drag sliders for what-if analysis");
        sub.setFont(new Font("Arial", Font.PLAIN, 12)); sub.setForeground(new Color(255,255,255,200));
        tl.add(pubNameL); tl.add(sub);
        JPanel tr = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 5)); tr.setOpaque(false);
        JButton swB = btn("Switch Pub", new Color(155,89,182)); swB.setFont(new Font("Arial", Font.BOLD, 11));
        swB.addActionListener(e -> {
            if (pubList.size()<=1) return;
            String[] ns = new String[pubList.size()];
            for (int i=0;i<pubList.size();i++) ns[i]=pubList.get(i).name;
            String s = (String)JOptionPane.showInputDialog(this,"Select:","Switch",JOptionPane.PLAIN_MESSAGE,null,ns,ns[curPubIdx]);
            if (s!=null) for (int i=0;i<pubList.size();i++) if (pubList.get(i).name.equals(s)) { curPubIdx=i; loadPub(pubList.get(i)); launchSim(); break; }
        });
        JButton bkB = btn("<< Back", new Color(44,62,80)); bkB.setFont(new Font("Arial", Font.BOLD, 11));
        bkB.addActionListener(e -> cards.show(mainP, "ENTRY"));
        tr.add(swB); tr.add(bkB);
        top.add(tl, BorderLayout.WEST); top.add(tr, BorderLayout.EAST);
        p.add(top, BorderLayout.NORTH);

        p.add(buildSliders(), BorderLayout.WEST);

        JScrollPane cs = new JScrollPane(buildResults());
        cs.setBorder(null); cs.getVerticalScrollBar().setUnitIncrement(16);
        p.add(cs, BorderLayout.CENTER);

        JScrollPane rs = new JScrollPane(buildInfo());
        rs.setBorder(null); rs.getVerticalScrollBar().setUnitIncrement(16);
        p.add(rs, BorderLayout.EAST);

        JPanel bot = new JPanel(); bot.setBackground(new Color(236,240,241));
        bot.setPreferredSize(new Dimension(1750, 28));
        JLabel bl = new JLabel("Baselines from YOUR real data | Payout = % of pub's baseline revenue");
        bl.setFont(new Font("Arial", Font.ITALIC, 11)); bot.add(bl);
        p.add(bot, BorderLayout.SOUTH);
        return p;
    }

    // SLIDERS: removed Revenue and Rent (6 sliders now)
    private JPanel buildSliders() {
        JPanel p = new JPanel(); p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        p.setBackground(new Color(240,243,245)); p.setBorder(BorderFactory.createEmptyBorder(8,10,8,10));
        p.setPreferredSize(new Dimension(385, 900));
        JLabel t = new JLabel("ADJUST PARAMETERS"); t.setFont(new Font("Arial", Font.BOLD, 14));
        t.setAlignmentX(Component.CENTER_ALIGNMENT); p.add(t);
        JLabel n = new JLabel("(green = your baseline)"); n.setFont(new Font("Arial", Font.ITALIC, 10));
        n.setForeground(new Color(46,204,113)); n.setAlignmentX(Component.CENTER_ALIGNMENT);
        p.add(n); p.add(Box.createVerticalStrut(8));

        ratingV=new JLabel(); ratingS=slider(p,"Star Rating (1.0-5.0)","Baseline: "+pf.format(inputRating),10,50,(int)(inputRating*10),ratingV,
            e->{currentRating=((JSlider)e.getSource()).getValue()/10.0;ratingV.setText(pf.format(currentRating)+" *");doUpdate();});
        priceV=new JLabel(); priceS=slider(p,"Pint Price (GBP 3-10)","Baseline: GBP "+pf.format(inputPrice),30,100,(int)(inputPrice*10),priceV,
            e->{currentPrice=((JSlider)e.getSource()).getValue()/10.0;priceV.setText("GBP "+pf.format(currentPrice));doUpdate();});
        hoursV=new JLabel(); hoursS=slider(p,"Daily Hours (8-24)","Baseline: "+inputHours+" hrs",8,24,inputHours,hoursV,
            e->{currentHours=((JSlider)e.getSource()).getValue();hoursV.setText(currentHours+" hrs");doUpdate();});
        lateV=new JLabel(); lateS=slider(p,"Late Night (0-5)","Baseline: "+inputLateHours+" ("+ct(inputLateHours)+")",0,5,inputLateHours,lateV,
            e->{currentLateHours=((JSlider)e.getSource()).getValue();lateV.setText(currentLateHours+" ("+ct(currentLateHours)+")");doUpdate();});
        areaV=new JLabel(); areaS=slider(p,"Floor Area (50-1000 sqm)","Baseline: "+df.format(inputArea)+" sqm",50,1000,cl((int)inputArea,50,1000),areaV,
            e->{currentArea=((JSlider)e.getSource()).getValue();areaV.setText(df.format(currentArea)+" sqm");doUpdate();});
        empV=new JLabel(); empS=slider(p,"Employees (1-50)","Baseline: "+inputEmployees,1,50,cl(inputEmployees,1,50),empV,
            e->{currentEmployees=((JSlider)e.getSource()).getValue();empV.setText(""+currentEmployees);doUpdate();});

        p.add(Box.createVerticalStrut(15));
        JButton rb = btn("RESET BASELINE", new Color(231,76,60)); rb.setAlignmentX(Component.CENTER_ALIGNMENT);
        rb.setMaximumSize(new Dimension(250, 38)); rb.addActionListener(e -> resetSliders()); p.add(rb);
        p.add(Box.createVerticalStrut(5));
        JButton rpb = btn("RESET POOL", new Color(52,152,219)); rpb.setAlignmentX(Component.CENTER_ALIGNMENT);
        rpb.setMaximumSize(new Dimension(250, 38));
        rpb.addActionListener(e -> { prizePool=POOL_DEFAULT; totalPayouts=0; doUpdate(); }); p.add(rpb);
        return p;
    }

    private int cl(int v, int lo, int hi) { return Math.min(hi, Math.max(lo, v)); }
    private String ct(int lh) {
        switch(lh){case 0:return"11pm";case 1:return"12am";case 2:return"1am";case 3:return"2am";case 4:return"3am";case 5:return"4am";default:return lh+"h";}
    }

    private JSlider slider(JPanel par, String title, String desc, int min, int max, int init, JLabel vl, ChangeListener ls) {
        JPanel bx = new JPanel(); bx.setLayout(new BoxLayout(bx, BoxLayout.Y_AXIS));
        bx.setBackground(Color.WHITE);
        bx.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createLineBorder(new Color(189,195,199),1),
            BorderFactory.createEmptyBorder(4,8,4,8)));
        bx.setMaximumSize(new Dimension(360, 85)); bx.setPreferredSize(new Dimension(360, 85));
        JPanel hd = new JPanel(new BorderLayout()); hd.setBackground(Color.WHITE);
        JLabel tl = new JLabel(title); tl.setFont(new Font("Arial", Font.BOLD, 10));
        vl.setFont(new Font("Arial", Font.BOLD, 11)); vl.setForeground(new Color(192,57,43));
        hd.add(tl, BorderLayout.WEST); hd.add(vl, BorderLayout.EAST); bx.add(hd);
        JLabel dl = new JLabel(desc); dl.setFont(new Font("Arial", Font.ITALIC, 9));
        dl.setForeground(new Color(46,204,113)); bx.add(dl);
        JSlider s = new JSlider(min, max, init); s.setBackground(Color.WHITE);
        s.setPaintTicks(true); s.setMajorTickSpacing(Math.max(1,(max-min)/4));
        s.setFont(new Font("Arial", Font.PLAIN, 8)); s.addChangeListener(ls);
        if (title.contains("Rating")) vl.setText(pf.format(init/10.0)+" *");
        else if (title.contains("Price")) vl.setText("GBP "+pf.format(init/10.0));
        else if (title.contains("Late")) vl.setText(init+" ("+ct(init)+")");
        else if (title.contains("Daily")) vl.setText(init+" hrs");
        else if (title.contains("Area")) vl.setText(df.format(init)+" sqm");
        else if (title.contains("Emp")) vl.setText(""+init);
        bx.add(s); par.add(bx); par.add(Box.createVerticalStrut(5));
        return s;
    }

    // RESULTS: order = Insurance, Revenue, Risk, Yield (yield moved to bottom)
    private JPanel buildResults() {
        JPanel p = new JPanel(); p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        p.setBackground(Color.WHITE); p.setBorder(BorderFactory.createEmptyBorder(12,10,12,10));
        JLabel t = new JLabel("METRICS & FORMULAS"); t.setFont(new Font("Arial", Font.BOLD, 14));
        t.setAlignmentX(Component.LEFT_ALIGNMENT); p.add(t); p.add(Box.createVerticalStrut(10));

        insL=new JLabel(); insF=new JTextArea();
        p.add(mbox("Insurance Premium", insL, insF, new Color(155,89,182), 7)); p.add(Box.createVerticalStrut(10));
        revResultL=new JLabel(); revF=new JTextArea();
        p.add(mbox("Adjusted Revenue", revResultL, revF, new Color(52,152,219), 5)); p.add(Box.createVerticalStrut(10));
        riskL=new JLabel(); riskF=new JTextArea();
        p.add(mbox("Risk Assessment", riskL, riskF, new Color(230,126,34), 7)); p.add(Box.createVerticalStrut(10));
        yieldL=new JLabel(); yieldF=new JTextArea();
        p.add(mbox("Investor Yield Rate", yieldL, yieldF, new Color(46,204,113), 7));
        p.add(Box.createVerticalStrut(30));
        return p;
    }

    private JPanel mbox(String name, JLabel vl, JTextArea fa, Color c, int rows) {
        JPanel ct = new JPanel(); ct.setLayout(new BoxLayout(ct, BoxLayout.Y_AXIS));
        ct.setBackground(Color.WHITE); ct.setAlignmentX(Component.LEFT_ALIGNMENT);
        int h = rows*16+65; ct.setMaximumSize(new Dimension(780,h)); ct.setPreferredSize(new Dimension(780,h));
        JPanel hd = new JPanel(new BorderLayout(8,0)); hd.setBackground(c);
        hd.setBorder(BorderFactory.createEmptyBorder(7,12,7,12));
        hd.setMaximumSize(new Dimension(780,36)); hd.setAlignmentX(Component.LEFT_ALIGNMENT);
        JLabel nl = new JLabel(name); nl.setFont(new Font("Arial", Font.BOLD, 13)); nl.setForeground(Color.WHITE);
        vl.setFont(new Font("Arial", Font.BOLD, 14)); vl.setForeground(Color.WHITE);
        vl.setHorizontalAlignment(SwingConstants.RIGHT);
        hd.add(nl, BorderLayout.WEST); hd.add(vl, BorderLayout.CENTER);
        ct.add(hd); ct.add(Box.createVerticalStrut(3));
        JPanel fb = new JPanel(new BorderLayout()); fb.setBackground(new Color(250,250,250));
        fb.setBorder(BorderFactory.createLineBorder(c, 1)); fb.setAlignmentX(Component.LEFT_ALIGNMENT);
        fa.setFont(new Font("Monospaced", Font.PLAIN, 10)); fa.setForeground(new Color(44,62,80));
        fa.setBackground(new Color(250,250,250)); fa.setEditable(false); fa.setLineWrap(false);
        fa.setRows(rows); fa.setBorder(BorderFactory.createEmptyBorder(5,8,5,8));
        JScrollPane sp = new JScrollPane(fa); sp.setBorder(null);
        fb.add(sp, BorderLayout.CENTER);
        ct.add(fb); return ct;
    }

    // ==================== INFO PANEL ====================
    private JPanel buildInfo() {
        JPanel p = new JPanel(); p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        p.setBackground(new Color(44,62,80)); p.setPreferredSize(new Dimension(360,1000));
        p.setBorder(BorderFactory.createEmptyBorder(12,12,12,12));
        JLabel t = new JLabel("POOL & PAYOUTS"); t.setFont(new Font("Arial", Font.BOLD, 15));
        t.setForeground(Color.WHITE); t.setAlignmentX(Component.CENTER_ALIGNMENT);
        p.add(t); p.add(Box.createVerticalStrut(12));
        poolL=new JLabel(); p.add(ibox("Prize Pool", poolL, new Color(26,188,156)));
        p.add(Box.createVerticalStrut(8));
        payoutL=new JLabel(); p.add(ibox("Auto Payout", payoutL, new Color(231,76,60)));
        p.add(Box.createVerticalStrut(8));
        statusL=new JLabel(); p.add(ibox("Status", statusL, new Color(155,89,182)));
        p.add(Box.createVerticalStrut(15));
        JPanel ex = new JPanel(); ex.setLayout(new BoxLayout(ex, BoxLayout.Y_AXIS));
        ex.setBackground(new Color(52,73,94));
        ex.setBorder(BorderFactory.createCompoundBorder(BorderFactory.createLineBorder(new Color(149,165,166),1),
            BorderFactory.createEmptyBorder(10,10,10,10)));
        ex.setMaximumSize(new Dimension(340, 250));
        JLabel et = new JLabel("Auto-Payout Rules"); et.setFont(new Font("Arial", Font.BOLD, 12));
        et.setForeground(Color.WHITE); ex.add(et); ex.add(Box.createVerticalStrut(6));
        JTextArea ea = new JTextArea(
            "Payout = % of THIS PUB's baseline revenue\n\n" +
            ">= 90% baseline -> Safe (no payout)\n" +
            "< 90% baseline  -> Pay 5% of revenue\n" +
            "< 80% baseline  -> Pay 15% of revenue\n" +
            "< 70% baseline  -> Pay 30% of revenue\n\n" +
            "Payout deducted from Prize Pool.\n" +
            "Baseline = from YOUR real pub data.");
        ea.setFont(new Font("Monospaced", Font.PLAIN, 11)); ea.setForeground(new Color(236,240,241));
        ea.setBackground(new Color(52,73,94)); ea.setEditable(false); ea.setLineWrap(true);
        ea.setWrapStyleWord(true); ex.add(ea); p.add(ex);
        p.add(Box.createVerticalStrut(80)); return p;
    }

    private JPanel ibox(String label, JLabel vl, Color c) {
        JPanel b = new JPanel(); b.setLayout(new BoxLayout(b, BoxLayout.Y_AXIS));
        b.setBackground(c); b.setBorder(BorderFactory.createEmptyBorder(8,8,8,8));
        b.setMaximumSize(new Dimension(340,56)); b.setPreferredSize(new Dimension(340,56));
        JLabel l = new JLabel(label); l.setFont(new Font("Arial", Font.BOLD, 11));
        l.setForeground(Color.WHITE); l.setAlignmentX(Component.CENTER_ALIGNMENT);
        vl.setFont(new Font("Arial", Font.BOLD, 15)); vl.setForeground(Color.WHITE);
        vl.setAlignmentX(Component.CENTER_ALIGNMENT);
        b.add(l); b.add(Box.createVerticalStrut(3)); b.add(vl); return b;
    }

    // ==================== CALCULATIONS ====================
    private PubMetrics calc(double rating, double price, int hours, int late, double area, int emp, double rev, double rent) {
        PubMetrics m = new PubMetrics();
        double R = rev/100000.0;
        double pBase = area*2.5 + emp*450 + R*1200 + 800;
        double hR = 0.15*Math.log(1+late/4.0) + 0.08*(hours-12)/12.0;
        double pR = -0.08*(price-MARKET_PRICE)/MARKET_PRICE + 0.12*Math.pow(price/MARKET_PRICE, 2);
        double rR = 0.35*Math.exp(-0.8*(rating-2.5)) - 0.15;
        double rnR = 0.05*(rent/40000.0 - 1.0);
        double tR = hR + pR + rR + rnR;
        double lM = 1 + 0.3*(LONDON_CRIME/100) + 0.15*(LONDON_DENSITY/100);
        m.ins = pBase * (1+tR) * lM;
        double dM = 1 + 0.08*(hours-12)/12.0 + 0.12*Math.log(1+late/2.0) + 0.25*(rating-4.0);
        dM = Math.max(dM, 0.5);
        m.rev = rev * dM;
        return m;
    }

    private String rlevel(double r) {
        if (r>=1.0) return "Very Low"; if (r>=TH1) return "Low"; if (r>=TH2) return "Medium";
        if (r>=TH3) return "High"; return "Very High";
    }
    private double payoutAmount(double revRatio) {
        if (revRatio >= TH1) return 0;
        if (revRatio >= TH2) return baseRevFinal * 0.05;
        if (revRatio >= TH3) return baseRevFinal * 0.15;
        return baseRevFinal * 0.30;
    }
    private double payoutPct(double revRatio) {
        if (revRatio >= TH1) return 0; if (revRatio >= TH2) return 5;
        if (revRatio >= TH3) return 15; return 30;
    }
    private String pstatus(double r) {
        if (r>=TH1) return "Safe (>=90%)"; if (r>=TH2) return "Warning (<90%)";
        if (r>=TH3) return "Alert (<80%)"; return "Critical (<70%)";
    }

    // ==================== UPDATE ====================
    private void doUpdate() {
        // Use inputRevenue and inputRent directly (no sliders for these)
        PubMetrics c = calc(currentRating, currentPrice, currentHours, currentLateHours,
            currentArea, currentEmployees, inputRevenue, inputRent);
        double revRatio = c.rev / baseRevFinal;
        double yield = (c.ins / prizePool) * 100;
        String risk = rlevel(revRatio);
        double poAmt = payoutAmount(revRatio);
        double poPct = payoutPct(revRatio);
        String ps = pstatus(revRatio);

        if (poAmt > 0) { double actual = Math.min(poAmt, prizePool); prizePool -= actual; totalPayouts += actual; poAmt = actual; }

        double ic = ((c.ins - baseIns) / baseIns) * 100;
        insL.setText(String.format("GBP %s (%+.1f%%)", df.format(c.ins), ic));
        double R = inputRevenue/100000.0;
        double pB = currentArea*2.5 + currentEmployees*450 + R*1200 + 800;
        double hR = 0.15*Math.log(1+currentLateHours/4.0) + 0.08*(currentHours-12)/12.0;
        double pR = -0.08*(currentPrice-MARKET_PRICE)/MARKET_PRICE + 0.12*Math.pow(currentPrice/MARKET_PRICE,2);
        double rR = 0.35*Math.exp(-0.8*(currentRating-2.5)) - 0.15;
        double rnR = 0.05*(inputRent/40000.0 - 1.0);
        double tR = hR+pR+rR+rnR;
        double lM = 1+0.3*(LONDON_CRIME/100)+0.15*(LONDON_DENSITY/100);
        insF.setText(String.format(
            "P_base = area*2.5 + emp*450 + (rev/100k)*1200 + 800\n" +
            "       = %.0f*2.5 + %d*450 + %.1f*1200 + 800 = GBP %s\n\n" +
            "h_risk=%.4f  pp_risk=%.4f  r_risk=%.4f  rent_risk=%.4f\n" +
            "total_risk=%.4f  L_mult=%.3f\n" +
            "Insurance = GBP %s * (1+%.4f) * %.3f = GBP %s",
            currentArea, currentEmployees, R, df.format(pB), hR, pR, rR, rnR, tR, lM,
            df.format(pB), tR, lM, df.format(c.ins)));

        double rc = ((c.rev - baseRevFinal) / baseRevFinal) * 100;
        revResultL.setText(String.format("GBP %s (%+.1f%%)", df.format(c.rev), rc));
        double dM = 1 + 0.08*(currentHours-12)/12.0 + 0.12*Math.log(1+currentLateHours/2.0) + 0.25*(currentRating-4.0);
        dM = Math.max(dM, 0.5);
        revF.setText(String.format(
            "demand_mult = 1 + hrs_adj + late_adj + rating_adj = %.4f\n\n" +
            "Revenue = GBP %s x %.4f = GBP %s\nBaseline = GBP %s | Change: %+.1f%%",
            dM, df.format(inputRevenue), dM, df.format(c.rev), df.format(baseRevFinal), rc));

        // Risk (now before yield)
        riskL.setText(String.format("%s (%.0f%%)", risk, revRatio*100));
        riskF.setText(String.format(
            "Revenue Ratio = GBP %s / GBP %s = %.1f%%\n\n" +
            ">=100%%->Very Low >=90%%->Low >=80%%->Medium >=70%%->High <70%%->Very High\n\n" +
            "Current: %s\n" +
            "Payout: %.0f%% of baseline revenue (GBP %s) = GBP %s",
            df.format(c.rev), df.format(baseRevFinal), revRatio*100, risk,
            poPct, df.format(baseRevFinal), df.format(poAmt)));

        // Yield (now at bottom)
        yieldL.setText(String.format("%.2f%% APY", yield));
        yieldF.setText(String.format(
            "Yield = (Insurance / Pool) x 100%%\n= (GBP %s / GBP %s) x 100%%\n= %.2f%%\n\n" +
            "Higher risk -> Higher premium -> Higher yield\nBaseline ins: GBP %s | Current: GBP %s (%+.1f%%)",
            df.format(c.ins), df.format(prizePool), yield, df.format(baseIns), df.format(c.ins), ic));

        poolL.setText("GBP " + df.format(prizePool));
        payoutL.setText(poAmt>0 ? String.format("GBP %s (%.0f%% rev)", df.format(poAmt), poPct) : "GBP 0 (No Trigger)");
        statusL.setText(ps);
    }

    private void resetSliders() {
        currentRating=inputRating; currentPrice=inputPrice; currentHours=inputHours;
        currentLateHours=inputLateHours; currentArea=inputArea; currentEmployees=inputEmployees;
        ratingS.setValue((int)(inputRating*10)); priceS.setValue((int)(inputPrice*10));
        hoursS.setValue(inputHours); lateS.setValue(inputLateHours);
        areaS.setValue(cl((int)inputArea,50,1000)); empS.setValue(cl(inputEmployees,1,50));
        doUpdate();
    }

    private static class PubData {
        String name; double area; int employees; double revenue; double rent;
        double rating; double price; int hours; int lateHours;
    }
    private static class PubMetrics { double rev; double ins; }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(new Runnable() {
            public void run() {
                try { UIManager.setLookAndFeel(UIManager.getCrossPlatformLookAndFeelClassName()); }
                catch (Exception e) {}
                new Web3InsuranceSimulator().setVisible(true);
            }
        });
    }
}