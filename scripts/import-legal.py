"""Import only the reviewed legal-document allowlist, never an entire mailbox or Drive folder."""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('review_folder')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
review = Path(args.review_folder)
collection = 'FIPT & Literature Litigation Records/'
# source, collection, category, public title, descriptive note
selected = [
    ('additional-zip/1988-WSC-Select-Committee-Report-002 (1).pdf', 'background', 'Historical record', '1988 WSC Select Committee on Service Structure report', 'Historical report to the World Service Conference concerning service structure and group autonomy. Not a court filing.'),
    ('additional-zip/Letter-re-Lawsuits-from-AE.pdf', 'background', 'Correspondence', 'Anthony Edmondson response concerning lawsuits', 'Undated historical response concerning litigation, literature support, and service finances. The statements reflect the author\'s position at the time, not a current case-status update or court ruling.'),
    ('additional-zip/Forum-on-Group-Autonomy.pdf', 'background', 'Commentary', 'Forum on Group Autonomy', 'Discussion of Tradition Four and group autonomy. Commentary, not a court filing.'),
    ('arna-petition.pdf', 'arna', 'Filing', 'ARNA petition with exhibits', 'Filed January 28, 2020. Petition concerning instructions, trustee compensation, removal and replacement of trustee, and surcharge.'),
    ('naws-demurrer.pdf', 'arna', 'Filing', 'NAWS notice of demurrer and demurrer', 'Includes memorandum of points and authorities and declaration of Jonathan H. Park. The cover lists a May 14, 2020 hearing.'),
    ('Bo-Sewell-Declaration-7.30.20.pdf', 'arna', 'Declaration', 'Bo Sewell declaration in support of opposition to demurrer', 'July 30, 2020. The original three-page scan is upside down; use the PDF reader rotation control.'),
    ('ARNAs-Letter-re-NAWS-false-statements.pdf', 'arna', 'Correspondence', 'ARNA counsel letter to NAWS counsel', 'February 24, 2023. Michael D. Adams to Jonathan H. Park regarding statements about the litigation. Correspondence, not a court ruling.'),
    (collection+'1990-11-27-Hollahan-Declaration.pdf', 'moorhead', 'Declaration', 'Hollahan declaration', 'November 27, 1990.'),
    (collection+'1990-11-27-Tooredman-Declaration.pdf', 'moorhead', 'Declaration', 'Tooredman declaration', 'November 27, 1990.'),
    (collection+'1991-01-02-WSO-vs-Moorhead-COMPLAINT.pdf', 'moorhead', 'Filing', 'WSO filing: preliminary-injunction memorandum', 'Archived under the filename COMPLAINT. The document begins with WSO\'s memorandum and arguments for a preliminary injunction.'),
    (collection+'1991-01-04-Court-Order.pdf', 'moorhead', 'Order', 'January 1991 order document', 'The supplied copy begins with an order labeled Exhibit A. See the signed agreement and hearing transcripts alongside it.'),
    (collection+'1991-01-04-WSO-v-Dave-M.-Signed-Agreement.pdf', 'moorhead', 'Agreement', 'WSO and David Moorhead signed agreement', 'Archived as January 4, 1991.'),
    ('Court-Transcript-of-Grateful-Dave-Moorhead-Lawsuit-text-searchable.pdf', 'moorhead', 'Transcript', 'January 2, 1991 hearing transcript - searchable copy', '160 pages. World Service Office, Inc. v. David Moorhead, before Judge Louis H. Pollak.'),
    ('1991-01-02-WSO-vs-Moorhead-Transcripts.pdf', 'moorhead', 'Transcript', 'January 2, 1991 hearing transcript - alternate scan', 'A second 160-page scan of the same proceeding, retained as a separate archival version.'),
    (collection+'1991-04-20-Jim-Kathleen-Millers-Declaration.pdf', 'moorhead', 'Declaration', 'Jim and Kathleen Miller declaration', 'Archived as April 20, 1991.'),
    (collection+'1992-04-22-Basis-For-Motion-for-Contempt.pdf', 'moorhead', 'Filing', 'Basis for motion for contempt', 'Archived as April 22, 1992.'),
    (collection+'1992-04-29-Court-Transcripts-of-Contempt-Hearing.pdf', 'moorhead', 'Transcript', 'April 29, 1992 contempt-hearing transcript', 'World Service Office, Inc. v. David Moorhead.'),
    (collection+'1992-04-Dave-M-Motion-for-Preliminary-Injuction.pdf', 'moorhead', 'Filing', 'David Moorhead motion notice: enforce or vacate and preliminary injunction', 'One-page April 1992 notice referring to motions and expedited proceedings; not the complete motion packet.'),
    (collection+'1990-01-18-Update-on-Lawsuit.pdf', 'background', 'Correspondence', 'WSO update on lawsuit and group registrations', 'The source is labeled January 18, 1990. Its reproduced dates should be read as printed, alongside the separately dated case records.'),
    (collection+'1990-07-10-Apology-Letter-on-Cease-and-Desist.pdf', 'background', 'Correspondence', 'Apology letter concerning cease-and-desist correspondence', 'Archived as July 10, 1990.'),
    (collection+'1990-07-10-Cease-and-Desist-Response-Form.pdf', 'background', 'Correspondence', 'Cease-and-desist response form', 'Archived as July 10, 1990.'),
    (collection+'1990-07-13-Daves-Lawyer-Response-Letter.pdf', 'background', 'Correspondence', 'Response letter from David Moorhead\'s lawyer', 'Archived as July 13, 1990. Historical correspondence, not a court ruling.'),
    (collection+'1990-10-Grateful-Dave-Terms.pdf', 'background', 'Historical record', 'Grateful Dave terms', 'October 1990 archival document.'),
    (collection+'1990-12-03-WSC-Administration-Vote-to-File-Suit.pdf', 'background', 'Historical record', 'WSC Administration vote to file suit', 'Archived as December 3, 1990.'),
    (collection+'1991-04-Pre-FIPT-Discussion-Transcript.pdf', 'background', 'Discussion transcript', 'Pre-FIPT discussion transcript', 'Archived as April 1991. Fellowship discussion, not a court-hearing transcript.'),
    (collection+'1991-Phone-Transcript-Trust-Doc.pdf', 'background', 'Discussion transcript', 'Trust-document telephone discussion transcript', 'Archived as 1991. Fellowship discussion, not a court-hearing transcript.'),
    (collection+'1992-07-22-moorhead-passing-letter-wso-vs-dave.pdf', 'background', 'Correspondence', 'Letter following David Moorhead\'s death', 'July 22, 1992. Counsel correspondence concerning the litigation.'),
    (collection+'1992-07-Miller-Letter-to-WSO-on-FIPT.pdf', 'background', 'Correspondence', 'Jim Miller letter and input to WSO on the FIPT', 'July 1992. Includes fellowship input and explanatory notes.'),
    (collection+'1992-bot-fipt-bulletin.pdf', 'background', 'Trust background', '1992 questions and answers on the proposed FIPT', 'World Service Board of Trustees background material.'),
    (collection+'1993-04-27-FIPT-Bulletin-1.pdf', 'background', 'Trust background', 'FIPT Bulletin 1: internal use of NA intellectual property', 'Historical policy approved April 27, 1993; not presented as current policy.'),
    ('WSO_BT_ComparisonDoc_as_ordered_by_Court.pdf', 'background', 'Historical record', 'WSO Basic Text comparison document', 'Archived as the comparison document ordered by the court.'),
    ('160424-FIPT-question-at-Open-Forum.pdf', 'background', 'Discussion transcript', 'WSC 2016 open-forum question concerning the FIPT', 'April 24, 2016. Fellowship discussion, not a court filing.'),
]
documents = []
seen = set()
for source, group, kind, title, note in selected:
    original = review / source
    raw = original.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest in seen:
        raise ValueError(f'Duplicate file in allowlist: {source}')
    seen.add(digest)
    reader = PdfReader(io.BytesIO(raw))
    slug = re.sub(r'[^a-z0-9]+', '-', original.stem.lower()).strip('-')
    relative = Path('legal/documents') / (slug + '.pdf')
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    documents.append({'id': slug, 'group': group, 'kind': kind, 'title': title, 'note': note,
                      'pdf': '/'+relative.as_posix(), 'pages': len(reader.pages),
                      'bytes': len(raw), 'sha256': digest, 'sourceName': original.name})
(root/'data/legal-documents.json').write_text(json.dumps({'documents': documents}, indent=2)+'\n', encoding='utf-8')
print(f'Imported {len(documents)} reviewed, distinct documents without changing their bytes.')
